import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ClipboardList, Loader2, Shield } from "lucide-react";
import ParticipantHeader from "@/components/ParticipantHeader";
import { isRelationshipPatternsStudy } from "@/studies/registry";

const Transition = () => {
  const navigate = useNavigate();
  const { participant, isLoading, activeStudy } = useParticipant();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (!isLoading && !checkingAdmin && !isAdmin) {
      checkAccess();
    }
  }, [isLoading, participant, checkingAdmin, isAdmin]);

  // Trigger background personality scoring when page loads
  useEffect(() => {
    if (participant && !isLoading) {
      triggerBackgroundScoring();
    }
  }, [participant, isLoading, activeStudy]);

  const triggerBackgroundScoring = async () => {
    if (!participant) return;

    try {
      if (isRelationshipPatternsStudy(activeStudy?.slug)) {
        const { data: existingSummary } = await supabase
          .from("attachment_classification_summaries")
          .select("id")
          .eq("participant_id", participant.id)
          .maybeSingle();

        if (existingSummary) return;

        supabase.functions.invoke("run-attachment-classification", {
          body: { participantId: participant.id },
        }).then(({ error }) => {
          if (error) console.error("Relationship classification error:", error);
          else console.log("Relationship classification completed successfully");
        }).catch((err) => {
          console.error("Relationship classification failed:", err);
        });
        return;
      }

      // Big Five path (unchanged).
      const { data: existingScores } = await supabase
        .from("personality_scores")
        .select("id")
        .eq("participant_id", participant.id)
        .eq("method", "llm")
        .maybeSingle();

      if (existingScores) {
        console.log("Personality scores already exist, skipping background scoring");
        return;
      }

      console.log("Triggering background personality scoring...");
      supabase.functions.invoke("score-personality-unified", {
        body: { participantId: participant.id },
      }).then(({ error }) => {
        if (error) console.error("Background scoring error:", error);
        else console.log("Background scoring completed successfully");
      }).catch((err) => {
        console.error("Background scoring failed:", err);
      });
    } catch (error) {
      console.error("Error checking existing scores:", error);
    }
  };

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

  const checkAccess = async () => {
    if (!participant) {
      navigate("/");
      return;
    }

    try {
      const requiredSessions = isRelationshipPatternsStudy(activeStudy?.slug) ? 1 : 20;
      const { data: sessionsData } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("participant_id", participant.id)
        .eq("is_complete", true);

      if (!sessionsData || sessionsData.length < requiredSessions) {
        navigate("/chat");
        return;
      }
    } catch (error) {
      console.error("Error checking access:", error);
      navigate("/");
    }
  };

  const handleContinue = () => {
    if (isRelationshipPatternsStudy(activeStudy?.slug)) {
      navigate("/attachment-profile");
      return;
    }
    navigate("/questionnaire");
  };

  if (isLoading || checkingAdmin) {
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

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="max-w-2xl mx-auto">
        {isAdmin && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2 text-sm text-primary">
            <Shield className="h-4 w-4" />
            Admin preview mode — redirects disabled
          </div>
        )}
        {participant && <ParticipantHeader />}
        <Card className="w-full mt-6">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl">Conversations Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p className="text-center">
                You've completed the AI conversation portion of this experiment.
                Thank you for sharing your thoughts and experiences.
              </p>
            </div>

            {isRelationshipPatternsStudy(activeStudy?.slug) ? (
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <ClipboardList className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Next: Inferred Profile</h3>
                    <p className="text-sm text-muted-foreground">
                      The system is analyzing the conversation several times to estimate attachment-related patterns.
                      You will see an experimental profile and a short narrative before the usability questions.
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li>This output is generated by an LLM and is not a clinical assessment</li>
                      <li>Repeated runs help the research team measure consistency</li>
                      <li>You will next rate the experience and whether the output felt plausible</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <ClipboardList className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Next: Personality Questionnaire</h3>
                    <p className="text-sm text-muted-foreground">
                      You'll now complete a standard Big Five personality questionnaire (IPIP-50).
                      This provides a baseline personality assessment to compare with the experimental
                      AI-based assessment from your conversations.
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li>Rate how accurately each statement describes you</li>
                      <li>Takes approximately 10-15 minutes</li>
                      <li>No right or wrong answers — respond honestly</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center pt-4">
              <Button onClick={handleContinue} size="lg" className="min-w-[200px]">
                {isRelationshipPatternsStudy(activeStudy?.slug) ? "View Profile" : "Continue to Questionnaire"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Transition;
