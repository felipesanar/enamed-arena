
-- Create public bucket for question images
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to question images
CREATE POLICY "Public read access for question images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'question-images');

-- Allow service role (admin edge functions) to upload
CREATE POLICY "Service role can upload question images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'question-images');

-- Allow service role to delete/update
CREATE POLICY "Service role can update question images"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'question-images');

CREATE POLICY "Service role can delete question images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'question-images');

-- Add explanation_image_url column to questions
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS explanation_image_url text;
