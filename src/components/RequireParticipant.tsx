import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useParticipant } from "@/contexts/ParticipantContext";
import type { AssessmentType } from "@/contexts/ParticipantContext";

interface LoadedParticipant {
  id: string;
  respondent_id: string;
  name: string | null;
  disabled?: boolean;
  assessment_type: AssessmentType;
}

interface RequireParticipantProps {
  children: (participant: LoadedParticipant) => ReactNode;
  /** If true, render children with a synthetic admin-preview participant when no real one exists. */
  allowAdminPreview?: boolean;
  /** Fallback assessment_type for admin preview mode. Defaults to "big5". */
  adminPreviewAssessment?: AssessmentType;
}

/**
 * Centralizes the loading / not-found / admin-preview handling that Chat, Questionnaire,
 * Accuracy, Results, and ParticipantDetails each used to reimplement inline. Wrap a page
 * with this and render a function-as-child that receives the loaded participant.
 */
export function RequireParticipant({
  children,
  allowAdminPreview = false,
  adminPreviewAssessment = "big5",
}: RequireParticipantProps) {
  const { participant, isLoading } = useParticipant();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!participant) {
    if (allowAdminPreview) {
      const previewParticipant: LoadedParticipant = {
        id: "admin-preview",
        respondent_id: "admin-preview",
        name: "Admin preview",
        assessment_type: adminPreviewAssessment,
      };
      return <>{children(previewParticipant)}</>;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md p-6">
          <h3 className="text-lg font-semibold text-destructive mb-2">No Session Found</h3>
          <p className="text-muted-foreground">
            Please use your unique session link to access the survey.
          </p>
        </Card>
      </div>
    );
  }

  return <>{children(participant)}</>;
}

