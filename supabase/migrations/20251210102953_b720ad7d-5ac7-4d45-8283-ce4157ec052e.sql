-- Make the call-recordings bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'call-recordings';