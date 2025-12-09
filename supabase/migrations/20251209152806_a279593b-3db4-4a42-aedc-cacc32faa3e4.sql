-- Make call-recordings bucket public for TTS audio playback by Twilio
UPDATE storage.buckets 
SET public = true 
WHERE id = 'call-recordings';

-- Add policy for public read access to TTS folder
CREATE POLICY "Public can read TTS audio files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'call-recordings' AND (storage.foldername(name))[1] = 'tts');