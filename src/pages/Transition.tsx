import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ClipboardList, Loader2, Shield } from "lucide-react";
import ParticipantHeader from "@/components/ParticipantHeader";

const Transition = () => {
  const navigate = useNavigate();
  const { participant, isLoading } = useParticipant();
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
  }, [participant, isLoading]);

  const triggerBackgroundScoring = async () => {
    if (!participant) return;

    try {
      // Check if scores already exist
      const { data: existingScores } = await supabase
        .from('personality_scores')
        .select('id')
        .eq('participant_id', participant.id)
        .eq('method', 'llm')
        .maybeSingle();

      if (existingScores) {
        console.log("Personality scores already exist, skipping background scoring");
        return;
      }

      // Fire and forget - trigger scoring in background
      console.log("Triggering background personality scoring...");
      supabase.functions.invoke('score-personality-unified', {
        body: { participantId: participant.id }
      }).then(({ data, error }) => {
        if (error) {
          console.error("Background scoring error:", error);
        } else {
          console.log("Background scoring completed successfully");
        }
      }).catch(err => {
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
      // Check if user completed all chat sessions
      const { data: sessionsData } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("participant_id", participant.id)
        .eq("is_complete", true);

      if (!sessionsData || sessionsData.length < 20) {
        navigate("/chat");
        return;
      }
    } catch (error) {
      console.error("Error checking access:", error);
      navigate("/");
    }
  };

  const handleContinue = () => {
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

            <div className="text-center pt-4">
              <Button onClick={handleContinue} size="lg" className="min-w-[200px]">
                Continue to Questionnaire
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Transition;
