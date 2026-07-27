/*
# NUVORA Storage Policies

Allows authenticated users to upload/manage files in NUVORA storage buckets.
Buckets: avatars, attachments, voice, statuses (all public-read).
*/

-- Avatars: users manage their own folder
DROP POLICY IF EXISTS "avatar_read_all" ON storage.objects;
CREATE POLICY "avatar_read_all" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatar_insert_own" ON storage.objects;
CREATE POLICY "avatar_insert_own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatar_update_own" ON storage.objects;
CREATE POLICY "avatar_update_own" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatar_delete_own" ON storage.objects;
CREATE POLICY "avatar_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');

-- Attachments
DROP POLICY IF EXISTS "attach_read_all" ON storage.objects;
CREATE POLICY "attach_read_all" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attach_insert_own" ON storage.objects;
CREATE POLICY "attach_insert_own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attach_delete_own" ON storage.objects;
CREATE POLICY "attach_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'attachments');

-- Voice
DROP POLICY IF EXISTS "voice_read_all" ON storage.objects;
CREATE POLICY "voice_read_all" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'voice');

DROP POLICY IF EXISTS "voice_insert_own" ON storage.objects;
CREATE POLICY "voice_insert_own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'voice');

DROP POLICY IF EXISTS "voice_delete_own" ON storage.objects;
CREATE POLICY "voice_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'voice');

-- Statuses
DROP POLICY IF EXISTS "status_read_all" ON storage.objects;
CREATE POLICY "status_read_all" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'statuses');

DROP POLICY IF EXISTS "status_insert_own" ON storage.objects;
CREATE POLICY "status_insert_own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'statuses');

DROP POLICY IF EXISTS "status_delete_own" ON storage.objects;
CREATE POLICY "status_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'statuses');
