import type { Json } from "@/integrations/supabase/types";

export type StudySlug =
  | "big5_original"
  | "relationship_patterns_cuq_sus_plausibility";

export type StudyBlockType =
  | "consent"
  | "transition"
  | "llm_interview"
  | "classifier"
  | "profile_display"
  | "survey"
  | "feedback"
  | "completion";

export interface StudyBlock {
  id: string;
  type: StudyBlockType;
  config?: Record<string, unknown>;
}

export interface StudyConfig {
  slug: StudySlug;
  version: number;
  blocks: StudyBlock[];
}

export interface ActiveStudy {
  assignmentId: string;
  assignmentStatus: string;
  studyId: string;
  studyVersionId: string;
  slug: StudySlug;
  name: string;
  version: number;
  config: StudyConfig;
}

export const STUDY_LABELS: Record<StudySlug, string> = {
  big5_original: "Artificial and Natural Intelligence (LTAT.02.024) Project",
  relationship_patterns_cuq_sus_plausibility: "Natural Language Processing (LTAT.01.001) Project",
};

export const DEFAULT_STUDY_FOR_SELF_REGISTRATION: StudySlug =
  "relationship_patterns_cuq_sus_plausibility";

export function isStudySlug(value: string | null | undefined): value is StudySlug {
  return (
    value === "big5_original" ||
    value === "relationship_patterns_cuq_sus_plausibility"
  );
}

export function isRelationshipPatternsStudy(slug: StudySlug | null | undefined): boolean {
  return slug === "relationship_patterns_cuq_sus_plausibility";
}

export function isBigFiveStudy(slug: StudySlug | null | undefined): boolean {
  return slug === "big5_original";
}

export function parseStudyConfig(value: Json, fallbackSlug: StudySlug): StudyConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { slug: fallbackSlug, version: 1, blocks: [] };
  }

  const obj = value as Record<string, unknown>;
  const slug = isStudySlug(obj.slug as string) ? (obj.slug as StudySlug) : fallbackSlug;
  const version = typeof obj.version === "number" ? obj.version : 1;
  const blocks = Array.isArray(obj.blocks)
    ? obj.blocks.filter(isStudyBlock)
    : [];

  return { slug, version, blocks };
}

function isStudyBlock(value: unknown): value is StudyBlock {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.id !== "string") return false;
  if (typeof obj.type !== "string") return false;
  return [
    "consent",
    "transition",
    "llm_interview",
    "classifier",
    "profile_display",
    "survey",
    "feedback",
    "completion",
  ].includes(obj.type);
}
