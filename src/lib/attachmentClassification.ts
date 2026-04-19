import type { AttachmentScore } from "@/lib/ecrScoring";

export type AttachmentStyle =
  | "secure"
  | "anxious_preoccupied"
  | "dismissive_avoidant"
  | "fearful_avoidant";

/**
 * Scale midpoint; anything strictly below is "low", anything at or above is "high".
 * Sample-median cutoffs are more faithful to the literature but require population
 * data. The midpoint is a conservative default for MVP and is documented in the
 * questionnaire footer copy.
 */
export const ATTACHMENT_CUTOFF = 4;

export function classifyAttachment({ anxiety, avoidance }: AttachmentScore): AttachmentStyle {
  const highAnxiety = anxiety >= ATTACHMENT_CUTOFF;
  const highAvoidance = avoidance >= ATTACHMENT_CUTOFF;
  if (!highAnxiety && !highAvoidance) return "secure";
  if (highAnxiety && !highAvoidance) return "anxious_preoccupied";
  if (!highAnxiety && highAvoidance) return "dismissive_avoidant";
  return "fearful_avoidant";
}

export interface AttachmentStyleInfo {
  style: AttachmentStyle;
  label: string;
  shortDescription: string;
  longDescription: string;
}

export const ATTACHMENT_STYLE_INFO: Record<AttachmentStyle, AttachmentStyleInfo> = {
  secure: {
    style: "secure",
    label: "Secure",
    shortDescription: "Low anxiety, low avoidance. Comfortable with closeness and independence.",
    longDescription:
      "People with a secure attachment style tend to feel at ease with emotional intimacy and interdependence. They can trust others, communicate needs openly, and recover well from relational stress without excessive worry or withdrawal.",
  },
  anxious_preoccupied: {
    style: "anxious_preoccupied",
    label: "Anxious-Preoccupied",
    shortDescription: "High anxiety, low avoidance. Seeks closeness, worries about rejection.",
    longDescription:
      "Anxious-preoccupied attachment involves a strong desire for closeness paired with heightened sensitivity to signs of rejection or distance. People with this style often seek reassurance, worry about partners' feelings, and may experience emotional ups-and-downs in relationships.",
  },
  dismissive_avoidant: {
    style: "dismissive_avoidant",
    label: "Dismissive-Avoidant",
    shortDescription: "Low anxiety, high avoidance. Values independence, uneasy with closeness.",
    longDescription:
      "Dismissive-avoidant attachment values self-reliance and emotional independence. People with this style may feel uncomfortable with too much closeness or dependence, prefer to handle difficulties alone, and downplay the importance of close relationships.",
  },
  fearful_avoidant: {
    style: "fearful_avoidant",
    label: "Fearful-Avoidant",
    shortDescription: "High anxiety, high avoidance. Wants closeness but finds it hard to trust.",
    longDescription:
      "Fearful-avoidant (sometimes called disorganized) attachment combines a wish for closeness with difficulty trusting others. People with this style can feel pulled between wanting intimacy and fearing hurt, leading to inconsistent or conflicted relationship patterns.",
  },
};

export function getAttachmentStyleInfo(style: AttachmentStyle): AttachmentStyleInfo {
  return ATTACHMENT_STYLE_INFO[style];
}
