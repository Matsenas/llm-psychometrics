import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useParticipant } from "@/contexts/ParticipantContext";
import { Loader2, ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Json } from "@/integrations/supabase/types";
import type { ActiveStudy } from "@/studies/registry";
import { isStudySlug, parseStudyConfig } from "@/studies/registry";
import { getNextRouteForParticipant } from "@/studies/progress";

interface StudyJoin {
  id: string;
  slug: string | null;
  name: string | null;
}

interface StudyVersionJoin {
  id: string;
  version_number: number | null;
  config: Json;
  studies: StudyJoin | StudyJoin[] | null;
}

interface AssignmentJoin {
  id: string;
  status: string;
  study_id: string;
  study_version_id: string;
  study_versions: StudyVersionJoin | StudyVersionJoin[] | null;
}

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

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
          .select("id, respondent_id, name, email, user_id, disabled")
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
            });
            const redirectPath = await checkParticipantProgress(participant.id);
            navigate(redirectPath);
            return;
          }

          if (participant.email) {
            setError("This participant account uses email sign-in. Please sign in with the email and password assigned by the study team.");
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
        });

        // Check participant progress and redirect appropriately
        const redirectPath = await checkParticipantProgress(participant.id);
        navigate(redirectPath);
      } catch (err: unknown) {
        console.error("Session validation error:", err);
        setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
      }
    };

    validateAndRedirect();
  }, [respondentId, navigate, setParticipant]);

  const checkParticipantProgress = async (participantId: string): Promise<string> => {
    const activeStudy = await loadActiveStudy(participantId);
    return getNextRouteForParticipant({ id: participantId }, activeStudy);
  };

  const loadActiveStudy = async (participantId: string): Promise<ActiveStudy | null> => {
    const { data } = await supabase
      .from("participant_study_assignments")
      .select(`
        id,
        status,
        study_id,
        study_version_id,
        study_versions (
          id,
          version_number,
          config,
          studies (
            id,
            slug,
            name
          )
        )
      `)
      .eq("participant_id", participantId)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    const assignment = data as AssignmentJoin;
    const version = firstJoin(assignment.study_versions);
    const study = firstJoin(version?.studies);
    if (!version || !isStudySlug(study?.slug)) return null;

    const config = parseStudyConfig(version.config, study.slug);
    return {
      assignmentId: assignment.id,
      assignmentStatus: assignment.status,
      studyId: assignment.study_id,
      studyVersionId: assignment.study_version_id,
      slug: study.slug,
      name: study.name ?? study.slug,
      version: version.version_number ?? config.version,
      config,
    };
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
