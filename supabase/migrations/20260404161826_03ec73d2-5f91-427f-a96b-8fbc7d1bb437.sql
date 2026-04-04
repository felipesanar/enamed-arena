-- Create private storage bucket for exam PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-pdfs', 'exam-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Allow service role (edge functions) full access; no public access
CREATE POLICY "Service role can manage exam PDFs"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'exam-pdfs')
WITH CHECK (bucket_id = 'exam-pdfs');