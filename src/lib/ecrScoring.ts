import { ECR_ITEMS, ECR_SCALE_MAX, EcrSubscale } from "@/lib/ecrItems";

export interface AttachmentScore {
  anxiety: number;
  avoidance: number;
}

export interface EcrResponseInput {
  itemNumber: number;
  value: number;
}

/**
 * Compute ECR-R subscale averages on the native 1-7 scale.
 * Reverse-keys items per the published scoring rules, then averages each subscale.
 * Throws if any item is missing a response.
 */
export function scoreEcrResponses(responses: EcrResponseInput[]): AttachmentScore {
  const byItem = new Map(responses.map((r) => [r.itemNumber, r.value]));

  const averageFor = (subscale: EcrSubscale): number => {
    const items = ECR_ITEMS.filter((i) => i.subscale === subscale);
    let sum = 0;
    for (const item of items) {
      const raw = byItem.get(item.itemNumber);
      if (raw === undefined) {
        throw new Error(`Missing response for ECR item ${item.itemNumber} (${subscale})`);
      }
      // 7-point scale reverse-key: 1<->7, 2<->6, ..., 4<->4. Formula: 8 - raw.
      sum += item.reverseKeyed ? ECR_SCALE_MAX + 1 - raw : raw;
    }
    return sum / items.length;
  };

  return {
    anxiety: averageFor("anxiety"),
    avoidance: averageFor("avoidance"),
  };
}
