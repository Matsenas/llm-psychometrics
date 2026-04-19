import type { Tables, Json } from "@/integrations/supabase/types";

export type AttachmentMethod = "llm" | "self";
export type Confidence = "low" | "medium" | "high";

export interface AttachmentLlmMetadata {
  confidence?: Confidence;
  key_evidence?: {
    anxiety?: string[];
    avoidance?: string[];
  };
  reasoning?: {
    anxiety?: string;
    avoidance?: string;
  };
  overall_assessment?: string;
}

/**
 * Typed view of an attachment_scores row. Cast at the Supabase query boundary;
 * never propagate `Json` (effectively any) through the app.
 */
export interface AttachmentScoreRow {
  id: string;
  participant_id: string;
  method: AttachmentMethod;
  anxiety: number;
  avoidance: number;
  llm_metadata: AttachmentLlmMetadata | null;
  created_at: string;
}

export function toAttachmentScoreRow(
  row: Tables<"attachment_scores">,
): AttachmentScoreRow {
  return {
    id: row.id,
    participant_id: row.participant_id,
    method: row.method as AttachmentMethod,
    anxiety: Number(row.anxiety),
    avoidance: Number(row.avoidance),
    llm_metadata: (row.llm_metadata as Json as AttachmentLlmMetadata | null) ?? null,
    created_at: row.created_at,
  };
}
