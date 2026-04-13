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

const PREFERENCE_LABELS = {
  1: "Chat was much more accurate",
  2: "Chat was slightly more accurate",
  3: "Both were equally accurate",
  4: "IPIP was slightly more accurate",
  5: "IPIP was much more accurate",
};

const Results = () => {
  const [overallPreference, setOverallPreference] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scoresData, setScoresData] = useState<ScoresData | null>(null);
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
      let chatScoresData = {
        openness: 0,
        conscientiousness: 0,
        extraversion: 0,
        agreeableness: 0,
        neuroticism: 0,
      };
      if (llmScoresRes.data) {
        const llm = llmScoresRes.data;
        chatScoresData = {
          openness: ((llm.openness as any).score / 120) * 100,
          conscientiousness: ((llm.conscientiousness as any).score / 120) * 100,
          extraversion: ((llm.extraversion as any).score / 120) * 100,
          agreeableness: ((llm.agreeableness as any).score / 120) * 100,
          neuroticism: ((llm.neuroticism as any).score / 120) * 100,
        };
      }

      // Get IPIP scores from personality_scores
      let ipipScoresData = {
        openness: 0,
        conscientiousness: 0,
        extraversion: 0,
        agreeableness: 0,
        neuroticism: 0,
      };
      if (ipipScoresRes.data) {
        const ipip = ipipScoresRes.data;
        ipipScoresData = {
          openness: (ipip.openness as any).score,
          conscientiousness: (ipip.conscientiousness as any).score,
          extraversion: (ipip.extraversion as any).score,
          agreeableness: (ipip.agreeableness as any).score,
          neuroticism: (ipip.neuroticism as any).score,
        };
      }

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

    } catch (error: any) {
      console.error("Error loading results:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load results. Please try again.",
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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

  if (isLoading || !scoresData) {
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

export default Results;
