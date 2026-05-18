import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";
import ParticipantHeader from "@/components/ParticipantHeader";
import { Textarea } from "@/components/ui/textarea";
import ComparisonOverview from "@/components/ComparisonOverview";
import { CUQ_ITEMS, SUS_ITEMS, PLAUSIBILITY_ITEM } from "@/lib/usabilityInstruments";
import { scoreCuq, scoreSus } from "@/lib/usabilityScoring";
import { isRelationshipPatternsStudy } from "@/studies/registry";
import { bigFiveScoresFromJson, messageFromError, normalizeBigFiveLlmScores } from "@/lib/bigFiveScoreJson";

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

interface MissingDataState {
  title: string;
  description: string;
  actionLabel: string;
  actionPath: string;
}

const PREFERENCE_LABELS = {
  1: "Chat was much more accurate",
  2: "Chat was slightly more accurate",
  3: "Both were equally accurate",
  4: "IPIP was slightly more accurate",
  5: "IPIP was much more accurate",
};

const Results = () => {
  const { activeStudy } = useParticipant();
  if (isRelationshipPatternsStudy(activeStudy?.slug)) {
    return <RelationshipResults />;
  }
  return <BigFiveResults />;
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
            <CardDescription>{data.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate(data.actionPath)}>{data.actionLabel}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const BigFiveResults = () => {
  const [overallPreference, setOverallPreference] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scoresData, setScoresData] = useState<ScoresData | null>(null);
  const [missingData, setMissingData] = useState<MissingDataState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
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
    if (participant && !participantLoading) {
      loadResults();
    }
  }, [participant, participantLoading]);

  const loadResults = async () => {
    if (!participant) return;

    try {
      setIsLoading(true);
      setMissingData(null);

      // Load survey results and personality scores in parallel
      const [surveyResultRes, llmScoresRes, ipipScoresRes] = await Promise.all([
        supabase
          .from("survey_results")
          .select("*")
          .eq("participant_id", participant.id)
          .maybeSingle(),
        supabase
          .from("personality_scores")
          .select("*")
          .eq("participant_id", participant.id)
          .eq("method", "llm")
          .maybeSingle(),
        supabase
          .from("personality_scores")
          .select("*")
          .eq("participant_id", participant.id)
          .eq("method", "ipip")
          .maybeSingle(),
      ]);

      if (surveyResultRes.error) throw surveyResultRes.error;

      const surveyResult = surveyResultRes.data;

      if (!surveyResult) {
        // No results found, redirect to accuracy page
        navigate("/accuracy");
        return;
      }

      // Check if already submitted
      if (surveyResult.submitted) {
        setSubmitted(true);
      }

      // Get LLM scores from personality_scores (normalized to 0-100)
      if (!llmScoresRes.data) {
        setMissingData({
          title: "Results Not Ready",
          description:
            "AI personality scores are not available yet, so the final feedback questions cannot be shown.",
          actionLabel: "Return to Accuracy",
          actionPath: "/accuracy",
        });
        setScoresData(null);
        return;
      }
      const chatScoresData = normalizeBigFiveLlmScores(bigFiveScoresFromJson(llmScoresRes.data));

      // Get IPIP scores from personality_scores
      if (!ipipScoresRes.data) {
        setMissingData({
          title: "Results Not Ready",
          description:
            "Big Five questionnaire scores are not available yet, so the final feedback questions cannot be shown.",
          actionLabel: "Return to Accuracy",
          actionPath: "/accuracy",
        });
        setScoresData(null);
        return;
      }
      const ipipScoresData = bigFiveScoresFromJson(ipipScoresRes.data);

      setScoresData({
        chatScores: chatScoresData,
        ipipScores: ipipScoresData,
      });

      // Restore existing preference and feedback if present
      if (surveyResult.overall_method_preference) {
        setOverallPreference(surveyResult.overall_method_preference);
      }
      if (surveyResult.feedback) {
        setFeedback(surveyResult.feedback);
      }

    } catch (error: unknown) {
      console.error("Error loading results:", error);
      toast({
        title: "Error",
        description: messageFromError(error, "Failed to load results. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!participant) return;

    if (overallPreference === null) {
      toast({
        title: "Overall Preference Required",
        description: "Please indicate which method you found more accurate overall.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("survey_results")
        .update({
          overall_method_preference: overallPreference,
          feedback: feedback.trim(),
          submitted: true,
          submitted_at: new Date().toISOString(),
        })
        .eq("participant_id", participant.id);

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "Thank you!",
        description: "Your responses have been submitted successfully.",
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: messageFromError(error, "Unknown error"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Card className="w-full max-w-md p-6">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-center text-muted-foreground">
              Loading results...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (missingData) {
    return <MissingDataCard data={missingData} />;
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <div className="max-w-5xl mx-auto space-y-6">
          <ParticipantHeader hasSubmitted={true} />

          <Card>
            <CardHeader className="text-center">
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
              <CardTitle className="text-2xl">Survey Complete!</CardTitle>
              <CardDescription className="text-base">
                Thank you for your commitment and help in our research. Your participation 
                contributes to a better understanding of AI-based personality assessment methods.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">
                You may now close this window.
              </p>
            </CardContent>
          </Card>

          {scoresData && (
            <ComparisonOverview
              chatScores={scoresData.chatScores}
              ipipScores={scoresData.ipipScores}
            />
          )}
        </div>
      </div>
    );
  }

  if (!scoresData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Card className="w-full max-w-md p-6">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-center text-muted-foreground">
              Loading results...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <ParticipantHeader hasSubmitted={submitted} />

        <ComparisonOverview
          chatScores={scoresData.chatScores}
          ipipScores={scoresData.ipipScores}
        />

        <Card>
          <CardHeader>
            <CardTitle>Final Thoughts</CardTitle>
            <CardDescription>
              Please share your overall impression of the two assessment methods
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-medium">
                Overall, which method better captured your personality?
              </Label>
              <RadioGroup 
                value={overallPreference?.toString() ?? ""} 
                onValueChange={(v) => setOverallPreference(parseInt(v))}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <div key={value} className="flex items-center space-x-2">
                    <RadioGroupItem value={value.toString()} id={`preference-${value}`} />
                    <Label htmlFor={`preference-${value}`} className="cursor-pointer">
                      {PREFERENCE_LABELS[value as keyof typeof PREFERENCE_LABELS]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Additional Feedback (Optional)</Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share any thoughts about your experience..."
                className="min-h-[100px]"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={overallPreference === null || loading}
              className="w-full"
              size="lg"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit & Complete Survey
            </Button>
          </CardContent>
        </Card>

        {isAdmin && !participant && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Admin preview mode - no participant session active
          </p>
        )}
      </div>
    </div>
  );
};

const RelationshipResults = () => {
  const { participant, isLoading: participantLoading } = useParticipant();
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<{
    mean_anxiety: number;
    mean_avoidance: number;
    modal_prototype: string;
    displayed_narrative: string | null;
  } | null>(null);
  const [scores, setScores] = useState<{ cuq: number | null; sus: number | null; plausibility: number | null }>({
    cuq: null,
    sus: null,
    plausibility: null,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!participant || participantLoading) return;
    const load = async () => {
      try {
        setIsLoading(true);
        const [summaryRes, responsesRes] = await Promise.all([
          supabase
            .from("attachment_classification_summaries")
            .select("mean_anxiety, mean_avoidance, modal_prototype, displayed_narrative")
            .eq("participant_id", participant.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("usability_responses")
            .select("instrument, item_key, response_value")
            .eq("participant_id", participant.id),
        ]);

        if (summaryRes.error) throw summaryRes.error;
        if (responsesRes.error) throw responsesRes.error;
        if (!summaryRes.data) {
          navigate("/attachment-profile");
          return;
        }

        const responseMap: Record<string, number> = {};
        responsesRes.data?.forEach((row) => {
          if (typeof row.response_value === "number") {
            responseMap[row.item_key] = row.response_value;
          }
        });

        setSummary({
          mean_anxiety: Number(summaryRes.data.mean_anxiety),
          mean_avoidance: Number(summaryRes.data.mean_avoidance),
          modal_prototype: summaryRes.data.modal_prototype,
          displayed_narrative: summaryRes.data.displayed_narrative,
        });
        setScores({
          cuq: scoreCuq(CUQ_ITEMS, responseMap),
          sus: scoreSus(SUS_ITEMS, responseMap),
          plausibility: responseMap[PLAUSIBILITY_ITEM.itemKey] ?? null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load results";
        toast({ title: "Error", description: message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [participant, participantLoading, navigate, toast]);

  if (participantLoading || isLoading || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <ParticipantHeader hasSubmitted={true} />
        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <CardTitle className="text-2xl">Study Complete</CardTitle>
            <CardDescription className="text-base">
              Thank you. Your interview and usability responses have been submitted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <ResultMetric label="CUQ" value={scores.cuq?.toFixed(1) ?? "-"} />
              <ResultMetric label="SUS" value={scores.sus?.toFixed(1) ?? "-"} />
              <ResultMetric label="Plausibility" value={scores.plausibility ? `${scores.plausibility}/5` : "-"} />
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              Attachment profile: {summary.modal_prototype}; Anxiety {summary.mean_anxiety.toFixed(2)}, Avoidance{" "}
              {summary.mean_avoidance.toFixed(2)}.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ResultMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-muted/50 p-4 text-center">
    <p className="text-xs uppercase text-muted-foreground">{label}</p>
    <p className="text-2xl font-semibold">{value}</p>
  </div>
);

export default Results;
