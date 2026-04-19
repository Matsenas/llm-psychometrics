import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Loader2, ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Session = () => {
  const { respondentId } = useParams<{ respondentId: string }>();
  const navigate = useNavigate();
  const { setParticipant } = useParticipant();
  const [error, setError] = useState<string | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);

  useEffect(() => {
    const validateAndRedirect = async () => {
      if (!respondentId) {
        setError("No session ID provided");
        return;
      }

      try {
        // First, find the participant
        const { data: participant, error: fetchError } = await supabase
          .from("participants")
          .select("id, respondent_id, name, user_id, disabled, assessment_type")
          .eq("respondent_id", respondentId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!participant) {
          setError("Invalid session ID. Please check your link.");
          return;
        }

        // Check if participant is disabled
        if (participant.disabled) {
          setIsDisabled(true);
          return;
        }

        // Check if participant already has a linked auth user
        if (participant.user_id) {
          const { data: { session: existingSession } } = await supabase.auth.getSession();
          
          if (existingSession?.user.id === participant.user_id) {
            // Same user, proceed
            setParticipant({
              id: participant.id,
              respondent_id: participant.respondent_id,
              name: participant.name,
              assessment_type: (participant.assessment_type as "big5" | "ecr") ?? "ecr",
            });
            const redirectPath = await checkParticipantProgress(participant.id);
            navigate(redirectPath);
            return;
          }
        }

        // Sign in anonymously
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
        
        if (authError) {
          console.error("Anonymous auth error:", authError);
          throw new Error("Failed to create session. Please try again.");
        }

        if (!authData.user) {
          throw new Error("Failed to create user session.");
        }

        // Link the anonymous user to the participant
        const { error: updateError } = await supabase
          .from("participants")
          .update({ user_id: authData.user.id })
          .eq("id", participant.id);

        if (updateError) {
          console.error("Failed to link participant:", updateError);
          throw new Error("Failed to link session to participant. Please try again.");
        }

        console.log("Successfully linked participant", participant.id, "to user", authData.user.id);

        // Set participant in context
        setParticipant({
          id: participant.id,
          respondent_id: participant.respondent_id,
          name: participant.name,
          assessment_type: (participant.assessment_type as "big5" | "ecr") ?? "ecr",
        });

        // Check participant progress and redirect appropriately
        const redirectPath = await checkParticipantProgress(participant.id);
        navigate(redirectPath);
      } catch (err: any) {
        console.error("Session validation error:", err);
        setError(err.message || "An error occurred. Please try again.");
      }
    };

    validateAndRedirect();
  }, [respondentId, navigate, setParticipant]);

  const checkParticipantProgress = async (participantId: string): Promise<string> => {
    // Check consent
    const { data: consent } = await supabase
      .from("consent_responses")
      .select("id")
      .eq("participant_id", participantId)
      .limit(1);

    if (!consent || consent.length === 0) {
      return "/consent";
    }

    // Check if any chat sessions exist (started)
    const { data: anySessions } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("participant_id", participantId)
      .limit(1);

    // If no sessions started yet, go to start page
    if (!anySessions || anySessions.length === 0) {
      return "/start";
    }

    // Check completed chat sessions
    const { data: completedSessions } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("participant_id", participantId)
      .eq("is_complete", true);

    const completedCount = completedSessions?.length || 0;

    if (completedCount < 20) {
      return "/chat";
    }

    // Check IPIP responses
    const { data: ipipResponses } = await supabase
      .from("ipip_responses")
      .select("id")
      .eq("participant_id", participantId);

    const ipipCount = ipipResponses?.length || 0;

    if (ipipCount === 0) {
      return "/transition";
    }

    if (ipipCount < 50) {
      return "/questionnaire";
    }

    // All done, go to results
    return "/results";
  };

  if (isDisabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md border-destructive/30">
          <CardHeader className="text-center">
            <ShieldX className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-destructive">Access Disabled</CardTitle>
            <CardDescription>
              Your access to this experiment has been revoked.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please contact the research team.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Session Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              Back home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading your session...</p>
      </div>
    </div>
  );
};

export default Session;
