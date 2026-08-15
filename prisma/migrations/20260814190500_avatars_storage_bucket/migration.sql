-- Storage bucket for profile photos.
--
-- Uploads go through the server using the secret key, which bypasses storage
-- RLS, so no INSERT policy is needed. The bucket is public so avatar URLs can
-- be rendered by <img> without signing every request.
--
-- Guarded on the storage schema existing: Prisma replays migrations into a
-- plain shadow database that has no Supabase extensions, and this must be a
-- no-op there rather than an error.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'avatars',
      'avatars',
      true,
      5242880,
      ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    )
    ON CONFLICT (id) DO UPDATE
      SET public = true,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END $$;
