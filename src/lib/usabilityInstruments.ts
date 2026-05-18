export interface LikertItem {
  instrument: "cuq" | "sus" | "plausibility";
  itemKey: string;
  text: string;
  reverse?: boolean;
}

export const CUQ_ITEMS: LikertItem[] = [
  { instrument: "cuq", itemKey: "cuq_01", text: "The chatbot's personality was realistic and engaging." },
  { instrument: "cuq", itemKey: "cuq_02", text: "The chatbot seemed too robotic.", reverse: true },
  { instrument: "cuq", itemKey: "cuq_03", text: "The chatbot was welcoming during initial setup." },
  { instrument: "cuq", itemKey: "cuq_04", text: "The chatbot seemed unfriendly.", reverse: true },
  { instrument: "cuq", itemKey: "cuq_05", text: "The chatbot explained its scope and purpose well." },
  { instrument: "cuq", itemKey: "cuq_06", text: "The chatbot gave no indication as to its purpose.", reverse: true },
  { instrument: "cuq", itemKey: "cuq_07", text: "The chatbot understood me well." },
  { instrument: "cuq", itemKey: "cuq_08", text: "The chatbot failed to recognize a lot of my input.", reverse: true },
  { instrument: "cuq", itemKey: "cuq_09", text: "The chatbot's responses were useful, appropriate, and informative." },
  { instrument: "cuq", itemKey: "cuq_10", text: "The chatbot's responses were irrelevant.", reverse: true },
  { instrument: "cuq", itemKey: "cuq_11", text: "The chatbot coped well with errors or unexpected input." },
  { instrument: "cuq", itemKey: "cuq_12", text: "The chatbot seemed unable to handle problems.", reverse: true },
  { instrument: "cuq", itemKey: "cuq_13", text: "The chatbot was easy to use." },
  { instrument: "cuq", itemKey: "cuq_14", text: "The chatbot was difficult to use.", reverse: true },
  { instrument: "cuq", itemKey: "cuq_15", text: "I would use a chatbot like this again." },
  { instrument: "cuq", itemKey: "cuq_16", text: "The chatbot experience was frustrating.", reverse: true },
];

export const SUS_ITEMS: LikertItem[] = [
  { instrument: "sus", itemKey: "sus_01", text: "I think that I would like to use this system frequently." },
  { instrument: "sus", itemKey: "sus_02", text: "I found the system unnecessarily complex.", reverse: true },
  { instrument: "sus", itemKey: "sus_03", text: "I thought the system was easy to use." },
  { instrument: "sus", itemKey: "sus_04", text: "I think that I would need support to use this system.", reverse: true },
  { instrument: "sus", itemKey: "sus_05", text: "I found the functions in this system well integrated." },
  { instrument: "sus", itemKey: "sus_06", text: "I thought there was too much inconsistency in this system.", reverse: true },
  { instrument: "sus", itemKey: "sus_07", text: "I imagine that most people would learn to use this system quickly." },
  { instrument: "sus", itemKey: "sus_08", text: "I found the system cumbersome to use.", reverse: true },
  { instrument: "sus", itemKey: "sus_09", text: "I felt confident using the system." },
  { instrument: "sus", itemKey: "sus_10", text: "I needed to learn a lot before I could use this system.", reverse: true },
];

export const PLAUSIBILITY_ITEM: LikertItem = {
  instrument: "plausibility",
  itemKey: "attachment_output_plausibility",
  text: "The output (attachment profile and narrative) seemed plausible given what I said during the conversation.",
};

export const USABILITY_LIKERT = [
  { value: 5, label: "Strongly agree" },
  { value: 4, label: "Agree" },
  { value: 3, label: "Neither agree nor disagree" },
  { value: 2, label: "Disagree" },
  { value: 1, label: "Strongly disagree" },
];

export const RELATIONSHIP_USABILITY_ITEMS = [...CUQ_ITEMS, ...SUS_ITEMS, PLAUSIBILITY_ITEM];
export const RELATIONSHIP_USABILITY_REQUIRED_ITEMS = RELATIONSHIP_USABILITY_ITEMS.length;

const RELATIONSHIP_USABILITY_REQUIRED_ITEM_KEYS = new Set(
  RELATIONSHIP_USABILITY_ITEMS.map((item) => item.itemKey),
);

export function countRelationshipUsabilityRequiredResponses(
  responses: Array<{ item_key: string; response_value?: number | null }>,
): number {
  const answeredRequiredItems = new Set<string>();

  responses.forEach((response) => {
    if (
      typeof response.response_value === "number" &&
      RELATIONSHIP_USABILITY_REQUIRED_ITEM_KEYS.has(response.item_key)
    ) {
      answeredRequiredItems.add(response.item_key);
    }
  });

  return answeredRequiredItems.size;
}
