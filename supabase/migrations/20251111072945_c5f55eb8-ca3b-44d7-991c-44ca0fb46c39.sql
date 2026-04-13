-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table for role-based access
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create consent_responses table
CREATE TABLE public.consent_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consented BOOLEAN NOT NULL DEFAULT false,
  consent_text TEXT NOT NULL,
  consented_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_sessions table (for the 20 conversations)
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_number INTEGER NOT NULL CHECK (session_number >= 1 AND session_number <= 20),
  big5_aspect TEXT NOT NULL,
  initial_question TEXT NOT NULL,
  is_complete BOOLEAN DEFAULT false,
  completion_criteria_met BOOLEAN DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, session_number)
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ipip_responses table
CREATE TABLE public.ipip_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_number INTEGER NOT NULL CHECK (item_number >= 1 AND item_number <= 30),
  item_text TEXT NOT NULL,
  is_positive_key BOOLEAN NOT NULL,
  response_value INTEGER NOT NULL CHECK (response_value >= 1 AND response_value <= 5),
  responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, item_number)
);

-- Create survey_results table
CREATE TABLE public.survey_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  openness_chat DECIMAL(5,2),
  conscientiousness_chat DECIMAL(5,2),
  extraversion_chat DECIMAL(5,2),
  agreeableness_chat DECIMAL(5,2),
  neuroticism_chat DECIMAL(5,2),
  openness_ipip DECIMAL(5,2),
  conscientiousness_ipip DECIMAL(5,2),
  extraversion_ipip DECIMAL(5,2),
  agreeableness_ipip DECIMAL(5,2),
  neuroticism_ipip DECIMAL(5,2),
  chat_rating INTEGER CHECK (chat_rating >= 1 AND chat_rating <= 5),
  ipip_rating INTEGER CHECK (ipip_rating >= 1 AND ipip_rating <= 5),
  submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipip_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for consent_responses
CREATE POLICY "Users can insert own consent"
  ON public.consent_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own consent"
  ON public.consent_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all consents"
  ON public.consent_responses FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for chat_sessions
CREATE POLICY "Users can manage own chat sessions"
  ON public.chat_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all chat sessions"
  ON public.chat_sessions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for chat_messages
CREATE POLICY "Users can manage own chat messages"
  ON public.chat_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = session_id
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all chat messages"
  ON public.chat_messages FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ipip_responses
CREATE POLICY "Users can manage own IPIP responses"
  ON public.ipip_responses FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all IPIP responses"
  ON public.ipip_responses FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for survey_results
CREATE POLICY "Users can manage own results"
  ON public.survey_results FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all results"
  ON public.survey_results FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create index for better query performance
CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_ipip_responses_user_id ON public.ipip_responses(user_id);
CREATE INDEX idx_survey_results_user_id ON public.survey_results(user_id);