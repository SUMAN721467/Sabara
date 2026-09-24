-- 1. Create 'banners' bucket in Supabase Storage if it doesn't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow public read access to all objects in 'banners' bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public Access for Banners' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Public Access for Banners"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'banners');
  END IF;
END $$;

-- 3. Allow authenticated users / service role to upload / insert objects into 'banners' bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Upload for Banners' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated Upload for Banners"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'banners');
  END IF;
END $$;

-- 4. Allow authenticated users / service role to update objects in 'banners' bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Update for Banners' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated Update for Banners"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'banners');
  END IF;
END $$;

-- 5. Allow authenticated users / service role to delete objects in 'banners' bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Delete for Banners' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated Delete for Banners"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'banners');
  END IF;
END $$;
