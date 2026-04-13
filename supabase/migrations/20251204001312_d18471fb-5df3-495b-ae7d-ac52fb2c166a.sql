-- Create a database function to calculate and store IPIP scores for a participant
CREATE OR REPLACE FUNCTION public.calculate_and_store_ipip_scores(p_participant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_openness numeric;
  v_conscientiousness numeric;
  v_extraversion numeric;
  v_agreeableness numeric;
  v_neuroticism numeric;
BEGIN
  -- Calculate Extraversion (items 1,6,11,16,21,26,31,36,41,46)
  SELECT ((SUM(
    CASE WHEN is_positive_key THEN response_value ELSE 6 - response_value END
  ) - 10) / 40.0) * 100
  INTO v_extraversion
  FROM ipip_responses
  WHERE participant_id = p_participant_id
    AND item_number IN (1, 6, 11, 16, 21, 26, 31, 36, 41, 46);
  
  -- Calculate Agreeableness (items 2,7,12,17,22,27,32,37,42,47)
  SELECT ((SUM(
    CASE WHEN is_positive_key THEN response_value ELSE 6 - response_value END
  ) - 10) / 40.0) * 100
  INTO v_agreeableness
  FROM ipip_responses
  WHERE participant_id = p_participant_id
    AND item_number IN (2, 7, 12, 17, 22, 27, 32, 37, 42, 47);
  
  -- Calculate Conscientiousness (items 3,8,13,18,23,28,33,38,43,48)
  SELECT ((SUM(
    CASE WHEN is_positive_key THEN response_value ELSE 6 - response_value END
  ) - 10) / 40.0) * 100
  INTO v_conscientiousness
  FROM ipip_responses
  WHERE participant_id = p_participant_id
    AND item_number IN (3, 8, 13, 18, 23, 28, 33, 38, 43, 48);
  
  -- Calculate Neuroticism (items 4,9,14,19,24,29,34,39,44,49)
  SELECT ((SUM(
    CASE WHEN is_positive_key THEN response_value ELSE 6 - response_value END
  ) - 10) / 40.0) * 100
  INTO v_neuroticism
  FROM ipip_responses
  WHERE participant_id = p_participant_id
    AND item_number IN (4, 9, 14, 19, 24, 29, 34, 39, 44, 49);
  
  -- Calculate Openness (items 5,10,15,20,25,30,35,40,45,50)
  SELECT ((SUM(
    CASE WHEN is_positive_key THEN response_value ELSE 6 - response_value END
  ) - 10) / 40.0) * 100
  INTO v_openness
  FROM ipip_responses
  WHERE participant_id = p_participant_id
    AND item_number IN (5, 10, 15, 20, 25, 30, 35, 40, 45, 50);
  
  -- Upsert into personality_scores
  INSERT INTO personality_scores (
    participant_id,
    method,
    openness,
    conscientiousness,
    extraversion,
    agreeableness,
    neuroticism
  ) VALUES (
    p_participant_id,
    'ipip',
    jsonb_build_object('score', GREATEST(0, LEAST(100, COALESCE(v_openness, 0)))),
    jsonb_build_object('score', GREATEST(0, LEAST(100, COALESCE(v_conscientiousness, 0)))),
    jsonb_build_object('score', GREATEST(0, LEAST(100, COALESCE(v_extraversion, 0)))),
    jsonb_build_object('score', GREATEST(0, LEAST(100, COALESCE(v_agreeableness, 0)))),
    jsonb_build_object('score', GREATEST(0, LEAST(100, COALESCE(v_neuroticism, 0))))
  )
  ON CONFLICT (participant_id, method) 
  DO UPDATE SET
    openness = EXCLUDED.openness,
    conscientiousness = EXCLUDED.conscientiousness,
    extraversion = EXCLUDED.extraversion,
    agreeableness = EXCLUDED.agreeableness,
    neuroticism = EXCLUDED.neuroticism;
END;
$$;

-- Backfill IPIP scores for participants with exactly 50 responses
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT participant_id
    FROM ipip_responses
    GROUP BY participant_id
    HAVING COUNT(*) = 50
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM personality_scores 
      WHERE participant_id = r.participant_id AND method = 'ipip'
    ) THEN
      PERFORM calculate_and_store_ipip_scores(r.participant_id);
    END IF;
  END LOOP;
END $$;