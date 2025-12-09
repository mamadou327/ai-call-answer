-- Add recording and transcription columns to calls_log
ALTER TABLE public.calls_log
ADD COLUMN IF NOT EXISTS recording_url text,
ADD COLUMN IF NOT EXISTS transcription text;

-- Create storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for call recordings bucket
CREATE POLICY "Business owners can view their recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'call-recordings' 
  AND EXISTS (
    SELECT 1 FROM calls_log cl
    JOIN businesses b ON b.id = cl.business_id
    WHERE b.owner_id = auth.uid()
    AND cl.recording_url LIKE '%' || storage.objects.name
  )
);

CREATE POLICY "Service role can upload recordings"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'call-recordings');