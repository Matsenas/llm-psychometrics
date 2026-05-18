import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield } from "lucide-react";
import ParticipantHeader from "@/components/ParticipantHeader";
import { calculateBig5Scores } from "@/lib/calculateBig5";
import TraitAccuracyRating, { TraitRatings } from "@/components/TraitAccuracyRating";
import { isRelationshipPatternsStudy } from "@/studies/registry";
import {
  bigFiveScoresFromJson,
  messageFromError,
  normalizeBigFiveLlmScores,
  type BigFiveTraitScores,
} from "@/lib/bigFiveScoreJson";

interface ScoresData {
  chatScores: BigFiveTraitScores;
  ipipScores: BigFiveTraitScores;
}

interface PersonalityScoringResult {
  success?: boolean;
  error?: string;
  scores?: BigFiveScoringPayload;
}

type BigFiveScoringPayload = Record<keyof BigFiveTraitScores, { score: number }>;

interface MissingDataState {
  title: string;
  description: string;
  actionLabel: string;
  actionPath: string;
}

// Mock scores for admin preview
const MOCK_SCORES: ScoresData = {
  chatScores: { openness: 72, conscientiousness: 65, extraversion: 48, agreeableness: 80, neuroticism: 35 },
  ipipScores: { openness: 68, conscientiousness: 70, extraversion: 52, agreeableness: 75, neuroticism: 40 },
};

const Accuracy = () => {
  const { activeStudy } = useParticipant();
  if (isRelationshipPatternsStudy(activeStudy?.slug)) {
    return <RelationshipAccuracyRedirect />;
  }
  return <BigFiveAccuracy />;
};

const MissingDataCard = ({ data }: { data: MissingDataState }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <ParticipantHeader />
        <Card>
          <CardHeader>
            <CardTitle>{data.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{data.description}</p>
            <Button onClick={() => navigate(data.actionPath)}>{data.actionLabel}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const RelationshipAccuracyRedirect = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/attachment-profile", { replace: true });
  }, [navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

const BigFiveAccuracy = () => {
  const [traitRatings, setTraitRatings] = useState<TraitRatings>({
    openness_chat_accuracy: null,
    openness_ipip_accuracy: null,
    conscientiousness_chat_accuracy: null,
    conscientiousness_ipip_accuracy: null,
    extraversion_chat_accuracy: null,
    extraversion_ipip_accuracy: null,
    agreeableness_chat_accuracy: null,
    agreeableness_ipip_accuracy: null,
    neuroticism_chat_accuracy: null,
    neuroticism_ipip_accuracy: null,
  });
  const [scoresData, setScoresData] = useState<ScoresData | null>(null);
  const [missingData, setMissingData] = useState<MissingDataState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { participant, isLoading: participantLoading } = useParticipant();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle();
        
        setIsAdmin(!!roleData);
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    } finally {
      setCheckingAdmin(false);
    }
  };

  useEffect(() => {
    if (!checkingAdmin) {
      if (participant && !participantLoading) {
        loadScores();
      } else if (isAdmin && !participant) {
        // Admin preview mode with mock data
        setMissingData(null);
        setScoresData(MOCK_SCORES);
        setIsLoading(false);
      }
    }
  }, [participant, participantLoading, checkingAdmin, isAdmin]);

  const loadScores = async () => {
    if (!participant) return;

    try {
      setIsLoading(true);
      setMissingData(null);

      // Fetch scores and existing ratings in parallel
      const [llmScoresResult, ipipScoresResult, existingRatingsResult, completedSessionsResult] = await Promise.all([
        supabase
          .from('personality_scores')
          .select('*')
          .eq('participant_id', participant.id)
          .eq('method', 'llm')
          .maybeSingle(),
        supabase
          .from('personality_scores')
          .select('*')
          .eq('participant_id', participant.id)
          .eq('method', 'ipip')
          .maybeSingle(),
        supabase
          .from('survey_results')
          .select('openness_chat_accuracy, openness_ipip_accuracy, conscientiousness_chat_accuracy, conscientiousness_ipip_accuracy, extraversion_chat_accuracy, extraversion_ipip_accuracy, agreeableness_chat_accuracy, agreeableness_ipip_accuracy, neuroticism_chat_accuracy, neuroticism_ipip_accuracy')
          .eq('participant_id', participant.id)
          .maybeSingle(),
        supabase
          .from("chat_sessions")
          .select("id")
          .eq("participant_id", participant.id)
          .eq("is_complete", true),
      ]);

      if (llmScoresResult.error) throw llmScoresResult.error;
      if (ipipScoresResult.error) throw ipipScoresResult.error;
      if (existingRatingsResult.error) throw existingRatingsResult.error;
      if (completedSessionsResult.error) throw completedSessionsResult.error;

      // Restore existing ratings if available
      if (existingRatingsResult.data) {
        const data = existingRatingsResult.data;
        setTraitRatings({
          openness_chat_accuracy: data.openness_chat_accuracy,
          openness_ipip_accuracy: data.openness_ipip_accuracy,
          conscientiousness_chat_accuracy: data.conscientiousness_chat_accuracy,
          conscientiousness_ipip_accuracy: data.conscientiousness_ipip_accuracy,
          extraversion_chat_accuracy: data.extraversion_chat_accuracy,
          extraversion_ipip_accuracy: data.extraversion_ipip_accuracy,
          agreeableness_chat_accuracy: data.agreeableness_chat_accuracy,
          agreeableness_ipip_accuracy: data.agreeableness_ipip_accuracy,
          neuroticism_chat_accuracy: data.neuroticism_chat_accuracy,
          neuroticism_ipip_accuracy: data.neuroticism_ipip_accuracy,
        });
      }

      // Handle IPIP scores
      let ipipScores;
      if (ipipScoresResult.data) {
        console.log("Using stored IPIP scores");
        ipipScores = bigFiveScoresFromJson(ipipScoresResult.data);
      } else {
        // Fallback: calculate from raw responses
        console.log("Calculating IPIP scores from responses");
        const { data: ipipResponses, error: ipipError } = await supabase
          .from("ipip_responses")
          .select("*")
          .eq("participant_id", participant.id)
          .order("item_number");

        if (ipipError) throw ipipError;

        if (!ipipResponses || ipipResponses.length < 50) {
          setMissingData({
            title: "Questionnaire Not Complete",
            description:
              "The Big Five self-report questionnaire needs to be completed before you can compare it with the chat assessment.",
            actionLabel: "Return to Questionnaire",
            actionPath: "/questionnaire",
          });
          setScoresData(null);
          return;
        }

        ipipScores = calculateBig5Scores(ipipResponses);
      }

      // Handle LLM scores
      let chatScores;
      const existingScores = llmScoresResult.data;

      if (existingScores) {
        console.log("Using existing personality scores");
        chatScores = bigFiveScoresFromJson(existingScores);
      } else {
        const completedSessionCount = completedSessionsResult.data?.length ?? 0;
        if (completedSessionCount < 20) {
          setMissingData({
            title: "Chat Assessment Not Complete",
            description:
              "All 20 Big Five chat sessions need to be completed before AI personality scores can be generated and rated.",
            actionLabel: "Return to Chat",
            actionPath: "/chat",
          });
          setScoresData(null);
          return;
        }

        console.log("Generating new personality scores via LLM");
        
        toast({
          title: "Analyzing your conversations...",
          description: "This may take 30-60 seconds. Please wait.",
        });

        const { data: scoringResult, error: scoringError } = await supabase.functions.invoke<PersonalityScoringResult>(
          'score-personality-unified',
          { body: { participantId: participant.id } }
        );

        if (scoringError) {
          console.error("Scoring error:", scoringError);
          throw new Error(messageFromError(scoringError, "Failed to generate scores"));
        }
        
        if (!scoringResult?.success || !scoringResult.scores) {
          throw new Error(scoringResult?.error || "Failed to generate scores");
        }

        console.log("Scores generated successfully");

        chatScores = {
          openness: scoringResult.scores.openness.score,
          conscientiousness: scoringResult.scores.conscientiousness.score,
          extraversion: scoringResult.scores.extraversion.score,
          agreeableness: scoringResult.scores.agreeableness.score,
          neuroticism: scoringResult.scores.neuroticism.score,
        };
      }

      // Convert 0-120 to 0-100 for display
      const normalizedChatScores = normalizeBigFiveLlmScores(chatScores);

      setScoresData({
        chatScores: normalizedChatScores,
        ipipScores,
      });

      // Ensure survey_results row exists for this participant
      await supabase
        .from("survey_results")
        .upsert({
          participant_id: participant.id,
        }, { onConflict: "participant_id" });

    } catch (error: unknown) {
      console.error("Error loading scores:", error);
      toast({
        title: "Error",
        description: messageFromError(error, "Failed to load scores. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Only update local state - saving happens on Next click
  const handleRatingsChange = (newRatings: TraitRatings) => {
    setTraitRatings(newRatings);
  };

  // Save current ratings to database
  const handleSave = async (): Promise<boolean> => {
    if (!participant) return true; // Admin preview - skip saving

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("survey_results")
        .upsert({
          participant_id: participant.id,
          ...traitRatings,
        }, { onConflict: "participant_id" });

      if (error) {
        console.error("Error saving ratings:", error);
        toast({
          title: "Error saving",
          description: "Failed to save ratings. Please try again.",
          variant: "destructive",
        });
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error saving ratings:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    const saved = await handleSave();
    if (saved) {
      navigate("/results");
    }
  };

  if (participantLoading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!participant && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">No Session Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please use your unique session link to access the survey.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (missingData) {
    return <MissingDataCard data={missingData} />;
  }

  if (isLoading || !scoresData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Card className="w-full max-w-md p-6">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-center text-muted-foreground">
              Analyzing your conversations with AI...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {isAdmin && !participant && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2 text-sm text-primary">
            <Shield className="h-4 w-4" />
            Admin preview mode — using mock data, saves disabled
          </div>
        )}
        {participant && <ParticipantHeader />}
        
        <TraitAccuracyRating
          chatScores={scoresData.chatScores}
          ipipScores={scoresData.ipipScores}
          ratings={traitRatings}
          onRatingsChange={handleRatingsChange}
          onSave={handleSave}
          onComplete={handleComplete}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
};

export default Accuracy;
