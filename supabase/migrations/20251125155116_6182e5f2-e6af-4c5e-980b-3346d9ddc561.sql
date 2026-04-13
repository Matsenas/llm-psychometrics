-- Create personality_scores table
CREATE TABLE IF NOT EXISTS personality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('unified', 'per_question', 'hybrid')),
  openness JSONB NOT NULL,
  conscientiousness JSONB NOT NULL,
  extraversion JSONB NOT NULL,
  agreeableness JSONB NOT NULL,
  neuroticism JSONB NOT NULL,
  overall_assessment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, method)
);

-- Enable RLS
ALTER TABLE personality_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own scores
CREATE POLICY "Users can read own scores"
  ON personality_scores FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can view all scores
CREATE POLICY "Admins can view all scores"
  ON personality_scores FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Users can manage own scores
CREATE POLICY "Users can manage own scores"
  ON personality_scores FOR ALL
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_personality_scores_user_method ON personality_scores(user_id, method);