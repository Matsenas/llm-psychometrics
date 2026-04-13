interface IPIPResponse {
  item_number: number;
  response_value: number;
  is_positive_key: boolean;
  item_text: string;
}

interface Big5Scores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

const TRAIT_ITEMS = {
  Extraversion: [1, 6, 11, 16, 21, 26, 31, 36, 41, 46],
  Agreeableness: [2, 7, 12, 17, 22, 27, 32, 37, 42, 47],
  Conscientiousness: [3, 8, 13, 18, 23, 28, 33, 38, 43, 48],
  Neuroticism: [4, 9, 14, 19, 24, 29, 34, 39, 44, 49],
  Openness: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
};

export function calculateBig5Scores(responses: IPIPResponse[]): Big5Scores {
  const scores: Big5Scores = {
    openness: 0,
    conscientiousness: 0,
    extraversion: 0,
    agreeableness: 0,
    neuroticism: 0,
  };

  // Create a map of item_number to response for quick lookup
  const responseMap = new Map<number, IPIPResponse>();
  responses.forEach(r => responseMap.set(r.item_number, r));

  // Calculate raw scores for each trait
  Object.entries(TRAIT_ITEMS).forEach(([trait, itemNumbers]) => {
    let rawScore = 0;
    
    itemNumbers.forEach(itemNum => {
      const response = responseMap.get(itemNum);
      if (response) {
        // For positive-keyed items, use the response value as is
        // For negative-keyed items, reverse the score (6 - value)
        const score = response.is_positive_key 
          ? response.response_value 
          : (6 - response.response_value);
        rawScore += score;
      }
    });

    // Normalize to 0-100 scale
    // Raw scores range from 10 (min: 10 items * 1) to 50 (max: 10 items * 5)
    // Normalize: (rawScore - 10) / (50 - 10) * 100
    const normalizedScore = ((rawScore - 10) / 40) * 100;
    
    const traitKey = trait.toLowerCase() as keyof Big5Scores;
    scores[traitKey] = Math.max(0, Math.min(100, normalizedScore));
  });

  return scores;
}
