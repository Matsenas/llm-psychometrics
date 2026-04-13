import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Lightbulb, Clock, Loader2, Shield } from "lucide-react";
import ParticipantHeader from "@/components/ParticipantHeader";

const Start = () => {
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

  const checkAdminStatus = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
      // Check if user has given consent
      const { data: consentData } = await supabase
        .from("consent_responses")
        .select("*")
        .eq("participant_id", participant.id)
        .eq("consented", true)
        .single();

      if (!consentData) {
        navigate("/consent");
        return;
      }

      // Check if user already started chats
      const { data: sessionsData } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("participant_id", participant.id);

      if (sessionsData && sessionsData.length > 0) {
        navigate("/chat");
        return;
      }
    } catch (error) {
      console.error("Error checking access:", error);
    }
  };

  const handleStart = () => {
    navigate("/chat");
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
            <p className="text-muted-foreground">Please use your unique session link to access the survey.</p>
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
                <MessageCircle className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl">Let's Get Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p className="text-center">
                This experiment starts with 20 short conversations with an AI assistant about everyday situations,
                preferences, and how you typically respond to things.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Tips for the Conversations</h3>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Be honest and open — there are no right or wrong answers</li>
                    <li>Respond naturally, as you would in a casual conversation</li>
                    <li>Share real examples from your life when relevant</li>
                    <li>Each conversation is brief, so don't overthink it</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Clock className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Time Estimate</h3>
                  <p className="text-sm text-muted-foreground">
                    The full experiment takes approximately 1 hour and 15 minutes. You can pause and return without
                    losing your progress. However, we recommend completing this in one sitting.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center pt-4">
              <Button onClick={handleStart} size="lg" className="min-w-[200px]">
                Start Conversations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Start;
