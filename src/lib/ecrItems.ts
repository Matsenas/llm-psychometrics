// Canonical ECR-R (Experiences in Close Relationships-Revised) item list.
// Source: Fraley, Waller, & Brennan (2000); item text and reverse-keying transcribed
// from ecr-guidance.pdf. Items 1-18 = Anxiety, 19-36 = Avoidance.
//
// This is the single source of truth for subscale membership and reverse-keying.
// ecr_responses in the database stores only { item_number, response_value }; all
// other metadata is looked up here.

export type EcrSubscale = "anxiety" | "avoidance";

export interface EcrItem {
  itemNumber: number;
  text: string;
  subscale: EcrSubscale;
  reverseKeyed: boolean;
}

export const ECR_ITEMS: readonly EcrItem[] = [
  // Anxiety subscale (items 1-18). Reverse-keyed: 9, 11.
  { itemNumber: 1, text: "I'm afraid that I will lose my partner's love.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 2, text: "I often worry that my partner will not want to stay with me.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 3, text: "I often worry that my partner doesn't really love me.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 4, text: "I worry that romantic partners won't care about me as much as I care about them.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 5, text: "I often wish that my partner's feelings for me were as strong as my feelings for him or her.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 6, text: "I worry a lot about my relationships.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 7, text: "When my partner is out of sight, I worry that he or she might become interested in someone else.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 8, text: "When I show my feelings for romantic partners, I'm afraid they will not feel the same about me.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 9, text: "I rarely worry about my partner leaving me.", subscale: "anxiety", reverseKeyed: true },
  { itemNumber: 10, text: "My romantic partner makes me doubt myself.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 11, text: "I do not often worry about being abandoned.", subscale: "anxiety", reverseKeyed: true },
  { itemNumber: 12, text: "I find that my partner(s) don't want to get as close as I would like.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 13, text: "Sometimes romantic partners change their feelings about me for no apparent reason.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 14, text: "My desire to be very close sometimes scares people away.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 15, text: "I'm afraid that once a romantic partner gets to know me, he or she won't like who I really am.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 16, text: "It makes me mad that I don't get the affection and support I need from my partner.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 17, text: "I worry that I won't measure up to other people.", subscale: "anxiety", reverseKeyed: false },
  { itemNumber: 18, text: "My partner only seems to notice me when I'm angry.", subscale: "anxiety", reverseKeyed: false },

  // Avoidance subscale (items 19-36). Reverse-keyed: 20, 22, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36.
  { itemNumber: 19, text: "I prefer not to show a partner how I feel deep down.", subscale: "avoidance", reverseKeyed: false },
  { itemNumber: 20, text: "I feel comfortable sharing my private thoughts and feelings with my partner.", subscale: "avoidance", reverseKeyed: true },
  { itemNumber: 21, text: "I find it difficult to allow myself to depend on romantic partners.", subscale: "avoidance", reverseKeyed: false },
  { itemNumber: 22, text: "I am very comfortable being close to romantic partners.", subscale: "avoidance", reverseKeyed: true },
  { itemNumber: 23, text: "I don't feel comfortable opening up to romantic partners.", subscale: "avoidance", reverseKeyed: false },
  { itemNumber: 24, text: "I prefer not to be too close to romantic partners.", subscale: "avoidance", reverseKeyed: false },
  { itemNumber: 25, text: "I get uncomfortable when a romantic partner wants to be very close.", subscale: "avoidance", reverseKeyed: false },
  { itemNumber: 26, text: "I find it relatively easy to get close to my partner.", subscale: "avoidance", reverseKeyed: true },
  { itemNumber: 27, text: "It's not difficult for me to get close to my partner.", subscale: "avoidance", reverseKeyed: true },
  { itemNumber: 28, text: "I usually discuss my problems and concerns with my partner.", subscale: "avoidance", reverseKeyed: true },
  { itemNumber: 29, text: "It helps to turn to my romantic partner in times of need.", subscale: "avoidance", reverseKeyed: true },
  { itemNumber: 30, text: "I tell my partner just about everything.", subscale: "avoidance", reverseKeyed: true },
  { itemNumber: 31, text: "I talk things over with my partner.", subscale: "avoidance", reverseKeyed: true },
  { itemNumber: 32, text: "I am nervous when partners get too close to me.", subscale: "avoidance", reverseKeyed: false },
  { itemNumber: 33, text: "I feel comfortable depending on romantic partners.", subscale: "avoidance", reverseKeyed: true },
  { itemNumber: 34, text: "I find it easy to depend on romantic partners.", subscale: "avoidance", reverseKeyed: true },
  { itemNumber: 35, text: "It's easy for me to be affectionate with my partner.", subscale: "avoidance", reverseKeyed: true },
  { itemNumber: 36, text: "My partner really understands me and my needs.", subscale: "avoidance", reverseKeyed: true },
];

export const ECR_SCALE_MIN = 1;
export const ECR_SCALE_MAX = 7;
export const ECR_ITEM_COUNT = ECR_ITEMS.length; // 36

export function getEcrItem(itemNumber: number): EcrItem {
  const item = ECR_ITEMS.find((i) => i.itemNumber === itemNumber);
  if (!item) throw new Error(`Unknown ECR item number: ${itemNumber}`);
  return item;
}
