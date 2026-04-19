import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import universityLogo from "@/assets/university-of-tartu-logo.png";

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [respondentId, setRespondentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { participant, setParticipant, isLoading: participantLoading, session } = useParticipant();
  const { toast } = useToast();

  useEffect(() => {
    if (!participantLoading) {
      checkUserStatus();
    }
  }, [participantLoading, participant, session]);

  const checkUserStatus = async () => {
    try {
      // Check if admin is logged in (non-anonymous authenticated user)
      if (session && !session.user.is_anonymous) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (roleData) {
          setIsAdmin(true);
          // Don't auto-redirect admins to /admin - let them stay on index if they want
          setLoading(false);
          return;
        }
      }

      // If participant session exists, check their progress
      if (participant) {
        await checkParticipantProgress(participant.id);
        return;
      }

      // No session - show entry form
      setLoading(false);
    } catch (error) {
      console.error("Error checking user status:", error);
      setLoading(false);
    }
  };

  const checkParticipantProgress = async (participantId: string) => {
    try {
      // Check consent
      const { data: consentData } = await supabase
        .from("consent_responses")
        .select("*")
        .eq("participant_id", participantId)
        .maybeSingle();

      if (!consentData) {
        navigate("/consent");
        return;
      }

      // Check chat sessions
      const { data: sessionsData } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("participant_id", participantId)
        .eq("is_complete", true);

      if (!sessionsData || sessionsData.length < 20) {
        navigate("/chat");
        return;
      }

      // Check IPIP responses
      const { data: ipipData } = await supabase.from("ipip_responses").select("*").eq("participant_id", participantId);

      if (!ipipData || ipipData.length === 0) {
        navigate("/transition");
        return;
      }

      if (ipipData.length < 50) {
        navigate("/questionnaire");
        return;
      }

      // Go to results
      navigate("/results");
    } catch (error) {
      console.error("Error checking participant progress:", error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!respondentId.trim()) {
      toast({
        title: "ID Required",
        description: "Please enter your respondent ID.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // First, lookup the participant by respondent_id
      const { data: participantData, error: lookupError } = await supabase
        .from("participants")
        .select("id, respondent_id, name, user_id, disabled, assessment_type")
        .eq("respondent_id", respondentId.trim())
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (!participantData) {
        toast({
          title: "ID Not Found",
          description: "This respondent ID was not found. Please check and try again.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Check if participant is disabled
      if (participantData.disabled) {
        toast({
          title: "Access Disabled",
          description: "Your access to this experiment has been revoked. Please contact the research team if you believe this is an error.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Check if participant already has a linked auth user
      if (participantData.user_id) {
        // Participant already has an auth session - they need to use the same browser/device
        // or we need to re-authenticate them
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession();

        if (existingSession?.user.id === participantData.user_id) {
          // Same user, proceed
          setParticipant({
            id: participantData.id,
            respondent_id: participantData.respondent_id,
            name: participantData.name,
            assessment_type: (participantData.assessment_type as "big5" | "ecr") ?? "ecr",
          });
          await checkParticipantProgress(participantData.id);
          return;
        }

        // Different user or no session - sign in anonymously and update the link
        // This handles the case where participant uses a different browser
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
        .eq("id", participantData.id);

      if (updateError) {
        console.error("Failed to link participant:", updateError);
        throw new Error("Failed to link session to participant. Please try again.");
      }

      console.log("Successfully linked participant", participantData.id, "to user", authData.user.id);

      setParticipant({
        id: participantData.id,
        respondent_id: participantData.respondent_id,
        name: participantData.name,
        assessment_type: (participantData.assessment_type as "big5" | "ecr") ?? "ecr",
      });

      // Check progress and redirect to appropriate step
      await checkParticipantProgress(participantData.id);
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  if (loading || participantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img src={universityLogo} alt="University of Tartu" className="h-20 w-20 object-contain mx-auto" />
          <div className="space-y-2">
            <CardTitle className="text-2xl">Can AI Understand Your Personality?</CardTitle>
            <CardDescription className="text-sm">
              A group project experiment for Artificial and Natural Intelligence (LTAT.02.024) at the University of
              Tartu.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">Enter your respondent ID to begin the survey</p>
              <Input
                value={respondentId}
                onChange={(e) => setRespondentId(e.target.value)}
                placeholder="457Xbba"
                className="text-center text-lg"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Experiment
            </Button>
          </form>

          <div className="text-center pt-2 border-t">
            <p className="text-sm text-muted-foreground pt-3">
              Want to participate?{" "}
              <a
                href="https://tally.so/r/q4Zv67"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:text-primary/80"
              >
                Sign up here
              </a>
            </p>
          </div>

          {isAdmin && (
            <div className="text-center pt-3 border-t mt-3">
              <p className="text-sm text-muted-foreground">
                Admin preview mode -{" "}
                <button
                  onClick={() => navigate("/admin")}
                  className="text-primary underline hover:text-primary/80"
                >
                  Go to Admin Dashboard
                </button>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
