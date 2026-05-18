import type { Json } from "@/integrations/supabase/types";
import {
  isStudySlug,
  StudyBlock,
  StudyBlockType,
  StudyConfig,
  StudySlug,
} from "@/studies/registry";

const BLOCK_TYPES: StudyBlockType[] = [
  "consent",
  "transition",
  "llm_interview",
  "classifier",
  "profile_display",
  "survey",
  "feedback",
  "completion",
];

export function validateStudyConfig(value: unknown, fallbackSlug: StudySlug) {
  const errors: string[] = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { config: null, errors: ["Config must be a JSON object."] };
  }

  const raw = value as Record<string, unknown>;
  const slug = isStudySlug(raw.slug as string) ? (raw.slug as StudySlug) : fallbackSlug;
  if (!isStudySlug(raw.slug as string)) {
    errors.push(`Config slug is missing or unsupported; expected one of ${slugList()}.`);
  }

  const version = typeof raw.version === "number" && raw.version >= 1 ? raw.version : 1;
  if (typeof raw.version !== "number") {
    errors.push("Config version must be a number.");
  }

  if (!Array.isArray(raw.blocks)) {
    errors.push("Config blocks must be an array.");
    return { config: null, errors };
  }

  const seenIds = new Set<string>();
  const blocks: StudyBlock[] = [];

  raw.blocks.forEach((block, index) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      errors.push(`Block ${index + 1} must be an object.`);
      return;
    }

    const candidate = block as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim() === "") {
      errors.push(`Block ${index + 1} must have a non-empty id.`);
      return;
    }
    if (seenIds.has(candidate.id)) {
      errors.push(`Block id "${candidate.id}" is duplicated.`);
      return;
    }
    seenIds.add(candidate.id);

    if (!BLOCK_TYPES.includes(candidate.type as StudyBlockType)) {
      errors.push(`Block "${candidate.id}" has unsupported type "${String(candidate.type)}".`);
      return;
    }

    if (
      candidate.config !== undefined &&
      (!candidate.config || typeof candidate.config !== "object" || Array.isArray(candidate.config))
    ) {
      errors.push(`Block "${candidate.id}" config must be an object when present.`);
      return;
    }

    blocks.push({
      id: candidate.id,
      type: candidate.type as StudyBlockType,
      config: (candidate.config as Record<string, unknown> | undefined) ?? undefined,
    });
  });

  if (blocks.length === 0) {
    errors.push("Config must include at least one valid block.");
  }

  if (errors.length > 0) {
    return { config: null, errors };
  }

  return {
    config: { slug, version, blocks } satisfies StudyConfig,
    errors: [],
  };
}

export function replaceStudyBlock(config: StudyConfig, block: StudyBlock): Json {
  return {
    ...config,
    blocks: config.blocks.map((current) => (current.id === block.id ? block : current)),
  } as Json;
}

function slugList() {
  return "big5_original, relationship_patterns_cuq_sus_plausibility";
}
