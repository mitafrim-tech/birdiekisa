
-- Drop the broad public SELECT policies and rely on the bucket being public
-- which makes files accessible by URL but not listable via the API.
DROP POLICY IF EXISTS "Public read team logos" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
