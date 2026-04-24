-- Public read access (buckets are public; make policy explicit)
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Public can view team logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-logos');

-- Authenticated users can upload into their own folder
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own team logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'team-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Owner-scoped UPDATE
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own team logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Owner-scoped DELETE (the actual fix for this finding)
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own team logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'team-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);