/*
# NUVORA Storage Setup

Creates the attachments storage bucket for file uploads (images, videos, voice messages, documents).
Sets up storage policies allowing authenticated users to upload and read attachments.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "attachments_read_all" ON storage.objects;
CREATE POLICY "attachments_read_all" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_insert_own" ON storage.objects;
CREATE POLICY "attachments_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments' AND auth.uid() = owner);

DROP POLICY IF EXISTS "attachments_update_own" ON storage.objects;
CREATE POLICY "attachments_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'attachments' AND auth.uid() = owner) WITH CHECK (bucket_id = 'attachments' AND auth.uid() = owner);

DROP POLICY IF EXISTS "attachments_delete_own" ON storage.objects;
CREATE POLICY "attachments_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'attachments' AND auth.uid() = owner);
