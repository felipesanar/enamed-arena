DROP POLICY IF EXISTS "Admins can upload question images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update question images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete question images" ON storage.objects;

CREATE POLICY "Admins can read question images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'question-images' AND (SELECT public.has_role(auth.uid(), 'admin'::public.app_role)));

CREATE POLICY "Admins can upload question images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'question-images' AND (SELECT public.has_role(auth.uid(), 'admin'::public.app_role)));

CREATE POLICY "Admins can update question images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'question-images' AND (SELECT public.has_role(auth.uid(), 'admin'::public.app_role)))
WITH CHECK (bucket_id = 'question-images' AND (SELECT public.has_role(auth.uid(), 'admin'::public.app_role)));

CREATE POLICY "Admins can delete question images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'question-images' AND (SELECT public.has_role(auth.uid(), 'admin'::public.app_role)));