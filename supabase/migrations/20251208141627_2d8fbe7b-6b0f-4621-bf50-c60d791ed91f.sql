-- Create table to store voice call conversation state
CREATE TABLE public.call_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_sid TEXT NOT NULL UNIQUE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  caller_phone TEXT NOT NULL,
  caller_name TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  intent TEXT,
  booking_id UUID REFERENCES public.bookings(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_conversations ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups by call_sid
CREATE INDEX idx_call_conversations_call_sid ON public.call_conversations(call_sid);
CREATE INDEX idx_call_conversations_business_id ON public.call_conversations(business_id);

-- RLS policies - conversations are managed by edge functions using service role
CREATE POLICY "Business owners can view their call conversations"
ON public.call_conversations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM businesses
  WHERE businesses.id = call_conversations.business_id
  AND businesses.owner_id = auth.uid()
));

-- Add updated_at trigger
CREATE TRIGGER update_call_conversations_updated_at
BEFORE UPDATE ON public.call_conversations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();