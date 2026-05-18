import type { LikertItem } from "@/lib/usabilityInstruments";

export function scoreCuq(items: LikertItem[], responses: Record<string, number>): number | null {
  const values = items.map((item) => responses[item.itemKey]).filter((value) => value !== undefined);
  if (values.length !== items.length) return null;

  const total = items.reduce((sum, item) => {
    const value = responses[item.itemKey];
    return sum + (item.reverse ? 6 - value : value);
  }, 0);

  return ((total - items.length) / (items.length * 4)) * 100;
}

export function scoreSus(items: LikertItem[], responses: Record<string, number>): number | null {
  const values = items.map((item) => responses[item.itemKey]).filter((value) => value !== undefined);
  if (values.length !== items.length) return null;

  const total = items.reduce((sum, item, index) => {
    const value = responses[item.itemKey];
    const contribution = index % 2 === 0 ? value - 1 : 5 - value;
    return sum + contribution;
  }, 0);

  return total * 2.5;
}
