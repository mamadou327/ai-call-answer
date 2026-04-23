-- Create voice_library table
CREATE TABLE public.voice_library (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voice_id text NOT NULL UNIQUE,
  name text NOT NULL,
  accent text NOT NULL CHECK (accent IN ('British', 'American')),
  gender text NOT NULL CHECK (gender IN ('female', 'male')),
  description text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_library ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) can read active voices
CREATE POLICY "Anyone can view active voices"
ON public.voice_library
FOR SELECT
USING (is_active = true);

-- Super admins can manage the library
CREATE POLICY "Super admins can manage voice library"
ON public.voice_library
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed voices (British first)
INSERT INTO public.voice_library (voice_id, name, accent, gender, description, display_order) VALUES
  -- British Female
  ('bm3QvaZ3fUSCRBC3UV1f', 'Olivia', 'British', 'female', 'Warm, friendly British female', 10),
  ('f1K8uOKtx0TAmtXBiLqx', 'Charlotte', 'British', 'female', 'Polished, professional British female', 20),
  ('HZJJHUcNj1ROZqPcCmzP', 'Emily', 'British', 'female', 'Clear, friendly British female', 30),
  ('4BWwbsA70lmV7RMG0Acs', 'Poppy', 'British', 'female', 'Sweet, crisp British female', 40),
  ('sIak7pFapfSLCfctxdOu', 'Florence', 'British', 'female', 'Soft, polite British female', 50),
  ('exsUS4vynmxd379XN4yO', 'Isla', 'British', 'female', 'Friendly, neutral British female', 60),
  -- British Male
  ('sIivXWc5MTlPIP3kJXhg', 'Oliver', 'British', 'male', 'Friendly, professional British male', 110),
  ('wUwsnXivqGrDWuz1Fc89', 'Henry', 'British', 'male', 'Warm, professional British male', 120),
  ('cwo4ramDmreHdb4b1Jxz', 'Edward', 'British', 'male', 'Calm, clear British male', 130),
  ('5hZv9mAOcmcMt1TxA5Iz', 'Arthur', 'British', 'male', 'Friendly, informative British male', 140),
  ('qMeZLxL57iwdz7D3XC3e', 'James', 'British', 'male', 'Friendly, professional British male', 150),
  ('9GrXx66oOqWm8wpkCAi2', 'William', 'British', 'male', 'Friendly, clear British male', 160),
  -- American Female
  ('aj0fZfXTBc7E3By4X8L2', 'Ava', 'American', 'female', 'Friendly, informative American female', 210),
  ('l0jEJEG5ZuUd9SnkaVdv', 'Mia', 'American', 'female', 'Friendly, helpful American female', 220),
  ('9TwzC887zQyDD4yBthzD', 'Zoe', 'American', 'female', 'Friendly, informative American female', 230),
  ('zxPaDs5RuZh7fQDkY6mP', 'Ruby', 'American', 'female', 'Bright, cheerful American female', 240),
  ('kIYbb5iUo0dJb8oRw5Mt', 'Hazel', 'American', 'female', 'Friendly, cheerful American female', 250),
  ('cYctNG9CmLHHErrIh5s7', 'Grace', 'American', 'female', 'Friendly, neutral American female', 260),
  ('L4so9SudEsIYzE9j4qlR', 'Nora', 'American', 'female', 'Clear, professional American female', 270),
  ('wlmwDR77ptH6bKHZui0l', 'Maya', 'American', 'female', 'Pleasant, friendly American female', 280),
  -- American Male
  ('tbLKqwAlNrjiwWmLpxI7', 'Mason', 'American', 'male', 'Friendly, informative American male', 310),
  ('L0Dsvb3SLTyegXwtm47J', 'Lucas', 'American', 'male', 'Friendly, helpful American male', 320),
  ('8Qks38ENjPxXSdubdeg8', 'Ethan', 'American', 'male', 'Friendly, neutral American male', 330),
  ('2Qe6CIQY9wj2WB9dT9nY', 'Owen', 'American', 'male', 'Friendly, professional American male', 340),
  ('mlvXFS1MP5qndOFkWz1M', 'Jack', 'American', 'male', 'Friendly, helpful American male', 350),
  ('LEfbhb9oqtzxg1yUjOqk', 'Theo', 'American', 'male', 'Clear, professional American male', 360);

-- Update default voice for new businesses to Olivia
ALTER TABLE public.business_settings
  ALTER COLUMN elevenlabs_voice_id SET DEFAULT 'bm3QvaZ3fUSCRBC3UV1f';
