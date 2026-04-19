import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield } from "lucide-react";
import ParticipantHeader from "@/components/ParticipantHeader";
import { calculateBig5Scores } from "@/lib/calculateBig5";
import TraitAccuracyRating, { TraitRatings } from "@/components/TraitAccuracyRating";
import EcrAccuracyRating, { EcrAccuracyRatings } from "@/components/ecr/EcrAccuracyRating";
import { scoreEcrResponses } from "@/lib/ecrScoring";
import { assertNever } from "@/lib/assertNever";

interface ScoresData {
  chatScores: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  ipipScores: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
}

// Mock scores for admin preview
const MOCK_SCORES: ScoresData = {
  chatScores: { openness: 72, conscientiousness: 65, extraversion: 48, agreeableness: 80, neuroticism: 35 },
  ipipScores: { openness: 68, conscientiousness: 70, extraversion: 52, agreeableness: 75, neuroticism: 40 },
};

const Accuracy = () => {
  const { participant } = useParticipant();
  if (participant) {
    switch (participant.assessment_type) {
      case "ecr":
        return <EcrAccuracy />;
      case "big5":
        break; // fall through to the existing Big Five implementation
      default:
        return assertNever(participant.assessment_type);
    }
  }
  return <BigFiveAccuracy />;
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
        setScoresData(MOCK_SCORES);
        setIsLoading(false);
      }
    }
  }, [participant, participantLoading, checkingAdmin, isAdmin]);

  const loadScores = async () => {
    if (!participant) return;

    try {
      setIsLoading(true);

      // Fetch scores and existing ratings in parallel
      const [llmScoresResult, ipipScoresResult, existingRatingsResult] = await Promise.all([
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
      ]);

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
        ipipScores = {
          openness: (ipipScoresResult.data.openness as any).score,
          conscientiousness: (ipipScoresResult.data.conscientiousness as any).score,
          extraversion: (ipipScoresResult.data.extraversion as any).score,
          agreeableness: (ipipScoresResult.data.agreeableness as any).score,
          neuroticism: (ipipScoresResult.data.neuroticism as any).score,
        };
      } else {
        // Fallback: calculate from raw responses
        console.log("Calculating IPIP scores from responses");
        const { data: ipipResponses, error: ipipError } = await supabase
          .from("ipip_responses")
          .select("*")
          .eq("participant_id", participant.id)
          .order("item_number");

        if (ipipError) throw ipipError;

        ipipScores = ipipResponses && ipipResponses.length > 0
          ? calculateBig5Scores(ipipResponses)
          : { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 };
      }

      // Handle LLM scores
      let chatScores;
      const existingScores = llmScoresResult.data;

      if (existingScores) {
        console.log("Using existing personality scores");
        chatScores = {
          openness: (existingScores.openness as any).score,
          conscientiousness: (existingScores.conscientiousness as any).score,
          extraversion: (existingScores.extraversion as any).score,
          agreeableness: (existingScores.agreeableness as any).score,
          neuroticism: (existingScores.neuroticism as any).score,
        };
      } else {
        console.log("Generating new personality scores via LLM");
        
        toast({
          title: "Analyzing your conversations...",
          description: "This may take 30-60 seconds. Please wait.",
        });

        const { data: scoringResult, error: scoringError } = await supabase.functions.invoke(
          'score-personality-unified',
          { body: { participantId: participant.id } }
        );

        if (scoringError) {
          console.error("Scoring error:", scoringError);
          // Try to extract error message from the response context
          const errorMessage = scoringError.context?.body?.error 
            || scoringError.message 
            || "Failed to generate scores";
          throw new Error(errorMessage);
        }
        
        if (!scoringResult?.success) {
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
      const normalizedChatScores = {
        openness: (chatScores.openness / 120) * 100,
        conscientiousness: (chatScores.conscientiousness / 120) * 100,
        extraversion: (chatScores.extraversion / 120) * 100,
        agreeableness: (chatScores.agreeableness / 120) * 100,
        neuroticism: (chatScores.neuroticism / 120) * 100,
      };

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

    } catch (error: any) {
      console.error("Error loading scores:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load scores. Please try again.",
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

const EcrAccuracy = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { participant, isLoading: participantLoading } = useParticipant();

  const [ratings, setRatings] = useState<EcrAccuracyRatings>({
    anxiety_chat_accuracy: null,
    anxiety_self_accuracy: null,
    avoidance_chat_accuracy: null,
    avoidance_self_accuracy: null,
  });
  const [chatScores, setChatScores] = useState<{ anxiety: number; avoidance: number } | null>(null);
  const [selfScores, setSelfScores] = useState<{ anxiety: number; avoidance: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    const check = async () => {
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
      } finally {
        setCheckingAdmin(false);
      }
    };
    check();
  }, []);

  useEffect(() => {
    if (checkingAdmin || participantLoading) return;
    if (!participant) {
      // Admin preview: use mock-ish values.
      setChatScores({ anxiety: 4.2, avoidance: 3.5 });
      setSelfScores({ anxiety: 3.8, avoidance: 4.1 });
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        setIsLoading(true);

        const [llmResult, selfResult, ratingsResult, ecrResult] = await Promise.all([
          supabase
            .from("attachment_scores")
            .select("anxiety, avoidance")
            .eq("participant_id", participant.id)
            .eq("method", "llm")
            .maybeSingle(),
          supabase
            .from("attachment_scores")
            .select("anxiety, avoidance")
            .eq("participant_id", participant.id)
            .eq("method", "self")
            .maybeSingle(),
          supabase
            .from("survey_results")
            .select(
              "anxiety_chat_accuracy, anxiety_self_accuracy, avoidance_chat_accuracy, avoidance_self_accuracy",
            )
            .eq("participant_id", participant.id)
            .maybeSingle(),
          supabase
            .from("ecr_responses")
            .select("item_number, response_value")
            .eq("participant_id", participant.id),
        ]);

        if (ratingsResult.data) {
          setRatings({
            anxiety_chat_accuracy: ratingsResult.data.anxiety_chat_accuracy,
            anxiety_self_accuracy: ratingsResult.data.anxiety_self_accuracy,
            avoidance_chat_accuracy: ratingsResult.data.avoidance_chat_accuracy,
            avoidance_self_accuracy: ratingsResult.data.avoidance_self_accuracy,
          });
        }

        // Self scores: prefer stored, fall back to recomputing from ecr_responses.
        if (selfResult.data) {
          setSelfScores({
            anxiety: Number(selfResult.data.anxiety),
            avoidance: Number(selfResult.data.avoidance),
          });
        } else if (ecrResult.data && ecrResult.data.length === 36) {
          const computed = scoreEcrResponses(
            ecrResult.data.map((r) => ({ itemNumber: r.item_number, value: r.response_value })),
          );
          setSelfScores(computed);
          await supabase
            .from("attachment_scores")
            .upsert(
              {
                participant_id: participant.id,
                method: "self",
                anxiety: Number(computed.anxiety.toFixed(2)),
                avoidance: Number(computed.avoidance.toFixed(2)),
                llm_metadata: null,
              },
              { onConflict: "participant_id,method" },
            );
        }

        // Chat (LLM) scores: stored or synchronously generated via edge fn.
        if (llmResult.data) {
          setChatScores({
            anxiety: Number(llmResult.data.anxiety),
            avoidance: Number(llmResult.data.avoidance),
          });
        } else {
          toast({
            title: "Analyzing your conversation...",
            description: "This may take 20–40 seconds. Please wait.",
          });
          const { data, error } = await supabase.functions.invoke("score-attachment-llm", {
            body: { participantId: participant.id },
          });
          if (error) throw error;
          if (data?.success) {
            setChatScores({
              anxiety: Number(data.anxiety),
              avoidance: Number(data.avoidance),
            });
          }
        }

        await supabase
          .from("survey_results")
          .upsert({ participant_id: participant.id }, { onConflict: "participant_id" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load scores";
        console.error("Error loading ECR accuracy scores:", error);
        toast({ title: "Error", description: message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [participant, participantLoading, checkingAdmin, toast]);

  const handleSave = async (): Promise<boolean> => {
    if (!participant) return true;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("survey_results")
        .upsert({ participant_id: participant.id, ...ratings }, { onConflict: "participant_id" });
      if (error) {
        toast({ title: "Error saving", description: "Please try again.", variant: "destructive" });
        return false;
      }
      return true;
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    const saved = await handleSave();
    if (saved) navigate("/results");
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

  if (isLoading || !chatScores || !selfScores) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Card className="w-full max-w-md p-6">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-center text-muted-foreground">
              Analyzing your conversation with AI...
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
        <EcrAccuracyRating
          chatScores={chatScores}
          selfScores={selfScores}
          ratings={ratings}
          onRatingsChange={setRatings}
          onSave={handleSave}
          onComplete={handleComplete}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
};

export default Accuracy;