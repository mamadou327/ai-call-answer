-- Create storage bucket for menu item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
CREATE POLICY "Menu images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'menu-images');

-- Create policy for authenticated users to upload their business menu images
CREATE POLICY "Business owners can upload menu images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'menu-images' 
  AND auth.uid() IS NOT NULL
);

-- Create policy for authenticated users to update their uploads
CREATE POLICY "Business owners can update menu images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'menu-images' 
  AND auth.uid() IS NOT NULL
);

-- Create policy for authenticated users to delete their uploads
CREATE POLICY "Business owners can delete menu images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'menu-images' 
  AND auth.uid() IS NOT NULL
);