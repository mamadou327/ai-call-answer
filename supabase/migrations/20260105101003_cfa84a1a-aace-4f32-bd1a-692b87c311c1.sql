-- Create public bucket for pre-generated demo audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('demo-audio', 'demo-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to demo audio files
CREATE POLICY "Public can view demo audio" ON storage.objects
FOR SELECT USING (bucket_id = 'demo-audio');

-- Allow authenticated users to upload demo audio (admins will use this)
CREATE POLICY "Authenticated users can upload demo audio" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'demo-audio' AND auth.role() = 'authenticated');

-- Allow authenticated users to update/delete demo audio
CREATE POLICY "Authenticated users can update demo audio" ON storage.objects
FOR UPDATE USING (bucket_id = 'demo-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete demo audio" ON storage.objects
FOR DELETE USING (bucket_id = 'demo-audio' AND auth.role() = 'authenticated');