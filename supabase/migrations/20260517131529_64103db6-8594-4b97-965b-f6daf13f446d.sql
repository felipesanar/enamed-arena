CREATE POLICY "Admins can upload question images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update question images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete question images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'question-images' AND public.has_role(auth.uid(), 'admin'));