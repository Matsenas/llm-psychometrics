-- First drop policies that depend on user_id columns

-- Drop chat_messages policy that references chat_sessions.user_id
DROP POLICY IF EXISTS "Users can manage own chat messages" ON public.chat_messages;

-- Drop chat_sessions policy
DROP POLICY IF EXISTS "Users can manage own chat sessions" ON public.chat_sessions;

-- Drop consent_responses policies
DROP POLICY IF EXISTS "Users can insert own consent" ON public.consent_responses;
DROP POLICY IF EXISTS "Users can view own consent" ON public.consent_responses;

-- Drop ipip_responses policy
DROP POLICY IF EXISTS "Users can manage own IPIP responses" ON public.ipip_responses;

-- Drop personality_scores policies
DROP POLICY IF EXISTS "Users can manage own scores" ON public.personality_scores;
DROP POLICY IF EXISTS "Users can read own scores" ON public.personality_scores;

-- Drop survey_results policy
DROP POLICY IF EXISTS "Users can manage own results" ON public.survey_results;

-- Now remove user_id columns
ALTER TABLE public.chat_sessions DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.consent_responses DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.ipip_responses DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.personality_scores DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.survey_results DROP COLUMN IF EXISTS user_id;