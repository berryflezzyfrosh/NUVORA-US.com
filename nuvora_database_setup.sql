/*
 * NUVORA Complete Database Setup
 * Run this entire script in your Supabase project's SQL Editor.
 * Creates all tables, relationships, indexes, RLS policies, storage buckets, and realtime subscriptions.
 */

-- ========== PROFILES ==========
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL,
  bio text DEFAULT '',
  avatar_url text DEFAULT '',
  phone text DEFAULT '',
  status_text text DEFAULT '',
  is_online boolean DEFAULT false,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ========== CONTACTS ==========
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, contact_id)
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- ========== BLOCKED USERS ==========
CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, blocked_id)
);
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- ========== CHATS ==========
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group','broadcast','community')),
  name text DEFAULT '',
  description text DEFAULT '',
  avatar_url text DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  only_admins_can_message boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- ========== CHAT MEMBERS ==========
CREATE TABLE IF NOT EXISTS chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin','owner')),
  joined_at timestamptz DEFAULT now(),
  muted boolean DEFAULT false,
  archived boolean DEFAULT false,
  pinned boolean DEFAULT false,
  last_read_message_id uuid,
  unread_count int DEFAULT 0,
  UNIQUE (chat_id, user_id)
);
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;

-- ========== MESSAGES ==========
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text DEFAULT '',
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','image','video','audio','voice','file','system','contact')),
  attachment_url text DEFAULT '',
  attachment_name text DEFAULT '',
  attachment_size bigint DEFAULT 0,
  attachment_mime text DEFAULT '',
  reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  forwarded_from uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_for_me_by uuid[] DEFAULT '{}',
  deleted_for_everyone boolean DEFAULT false,
  starred_by uuid[] DEFAULT '{}',
  delivered_to uuid[] DEFAULT '{}',
  read_by uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- ========== REACTIONS ==========
CREATE TABLE IF NOT EXISTS reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- ========== STATUSES (STORIES) ==========
CREATE TABLE IF NOT EXISTS statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL DEFAULT 'text' CHECK (content_type IN ('text','image','video')),
  body text DEFAULT '',
  media_url text DEFAULT '',
  background_color text DEFAULT '',
  caption text DEFAULT '',
  privacy text NOT NULL DEFAULT 'contacts' CHECK (privacy IN ('everyone','contacts','selected','excluded')),
  allowed_users uuid[] DEFAULT '{}',
  excluded_users uuid[] DEFAULT '{}',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;

-- ========== STATUS VIEWS ==========
CREATE TABLE IF NOT EXISTS status_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE (status_id, user_id)
);
ALTER TABLE status_views ENABLE ROW LEVEL SECURITY;

-- ========== CALLS ==========
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type text NOT NULL DEFAULT 'voice' CHECK (call_type IN ('voice','video')),
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','ringing','accepted','rejected','missed','ended','failed')),
  direction text NOT NULL DEFAULT 'outgoing' CHECK (direction IN ('incoming','outgoing','missed')),
  duration int DEFAULT 0,
  signal_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- ========== NOTIFICATIONS ==========
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text DEFAULT '',
  data jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ========== USER SETTINGS ==========
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  accent_color text DEFAULT '#0ea5e9',
  last_seen_visibility text DEFAULT 'everyone' CHECK (last_seen_visibility IN ('everyone','contacts','nobody')),
  profile_photo_visibility text DEFAULT 'everyone' CHECK (profile_photo_visibility IN ('everyone','contacts','nobody')),
  status_visibility text DEFAULT 'contacts' CHECK (status_visibility IN ('everyone','contacts','nobody')),
  read_receipts boolean DEFAULT true,
  typing_indicators boolean DEFAULT true,
  notification_messages boolean DEFAULT true,
  notification_groups boolean DEFAULT true,
  notification_calls boolean DEFAULT true,
  notification_statuses boolean DEFAULT true,
  enter_to_send boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- ========== AI CONVERSATIONS (NUVO) ==========
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- ========== TRIGGERS ==========
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_chats_updated ON chats;
CREATE TRIGGER trg_chats_updated BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_messages_updated ON messages;
CREATE TRIGGER trg_messages_updated BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========== AUTO-CREATE PROFILE ON SIGNUP ==========
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 4)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ========== RLS POLICIES ==========

-- PROFILES
DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- CONTACTS
DROP POLICY IF EXISTS "contacts_select_own" ON contacts;
CREATE POLICY "contacts_select_own" ON contacts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "contacts_insert_own" ON contacts;
CREATE POLICY "contacts_insert_own" ON contacts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "contacts_update_own" ON contacts;
CREATE POLICY "contacts_update_own" ON contacts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "contacts_delete_own" ON contacts;
CREATE POLICY "contacts_delete_own" ON contacts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- BLOCKED USERS
DROP POLICY IF EXISTS "blocked_select_own" ON blocked_users;
CREATE POLICY "blocked_select_own" ON blocked_users FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "blocked_insert_own" ON blocked_users;
CREATE POLICY "blocked_insert_own" ON blocked_users FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "blocked_delete_own" ON blocked_users;
CREATE POLICY "blocked_delete_own" ON blocked_users FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- CHATS
DROP POLICY IF EXISTS "chats_select_members" ON chats;
CREATE POLICY "chats_select_members" ON chats FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "chats_insert_own" ON chats;
CREATE POLICY "chats_insert_own" ON chats FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "chats_update_admin" ON chats;
CREATE POLICY "chats_update_admin" ON chats FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid() AND chat_members.role IN ('admin','owner'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid() AND chat_members.role IN ('admin','owner'))
  );

DROP POLICY IF EXISTS "chats_delete_owner" ON chats;
CREATE POLICY "chats_delete_owner" ON chats FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid() AND chat_members.role = 'owner')
  );

-- CHAT MEMBERS
DROP POLICY IF EXISTS "members_select_self_or_admin" ON chat_members;
CREATE POLICY "members_select_self_or_admin" ON chat_members FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM chat_members cm2
      WHERE cm2.chat_id = chat_members.chat_id
        AND cm2.user_id = auth.uid()
        AND cm2.role IN ('admin','owner')
    )
  );

DROP POLICY IF EXISTS "members_insert_admin" ON chat_members;
CREATE POLICY "members_insert_admin" ON chat_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_members cm2
      WHERE cm2.chat_id = chat_members.chat_id
        AND cm2.user_id = auth.uid()
        AND cm2.role IN ('admin','owner')
    )
    OR (
      auth.uid() = user_id
      AND NOT EXISTS (SELECT 1 FROM chat_members cm3 WHERE cm3.chat_id = chat_members.chat_id)
    )
  );

DROP POLICY IF EXISTS "members_update_self_or_admin" ON chat_members;
CREATE POLICY "members_update_self_or_admin" ON chat_members FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM chat_members cm2
      WHERE cm2.chat_id = chat_members.chat_id
        AND cm2.user_id = auth.uid()
        AND cm2.role IN ('admin','owner')
    )
  ) WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM chat_members cm2
      WHERE cm2.chat_id = chat_members.chat_id
        AND cm2.user_id = auth.uid()
        AND cm2.role IN ('admin','owner')
    )
  );

DROP POLICY IF EXISTS "members_delete_self_or_admin" ON chat_members;
CREATE POLICY "members_delete_self_or_admin" ON chat_members FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM chat_members cm2
      WHERE cm2.chat_id = chat_members.chat_id
        AND cm2.user_id = auth.uid()
        AND cm2.role IN ('admin','owner')
    )
  );

-- MESSAGES
DROP POLICY IF EXISTS "messages_select_members" ON messages;
CREATE POLICY "messages_select_members" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "messages_insert_members" ON messages;
CREATE POLICY "messages_insert_members" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "messages_update_sender_or_admin" ON messages;
CREATE POLICY "messages_update_sender_or_admin" ON messages FOR UPDATE
  TO authenticated USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.chat_id = messages.chat_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','owner')
    )
  ) WITH CHECK (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.chat_id = messages.chat_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','owner')
    )
  );

DROP POLICY IF EXISTS "messages_delete_sender_or_admin" ON messages;
CREATE POLICY "messages_delete_sender_or_admin" ON messages FOR DELETE
  TO authenticated USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.chat_id = messages.chat_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','owner')
    )
  );

-- REACTIONS
DROP POLICY IF EXISTS "reactions_select_members" ON reactions;
CREATE POLICY "reactions_select_members" ON reactions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = auth.uid()
      WHERE m.id = reactions.message_id
    )
  );

DROP POLICY IF EXISTS "reactions_insert_own" ON reactions;
CREATE POLICY "reactions_insert_own" ON reactions FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = auth.uid()
      WHERE m.id = reactions.message_id
    )
  );

DROP POLICY IF EXISTS "reactions_delete_own" ON reactions;
CREATE POLICY "reactions_delete_own" ON reactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- STATUSES
DROP POLICY IF EXISTS "statuses_select_visible" ON statuses;
CREATE POLICY "statuses_select_visible" ON statuses FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR (
      privacy = 'everyone'
      AND NOT EXISTS (SELECT 1 FROM blocked_users b WHERE b.user_id = statuses.user_id AND b.blocked_id = auth.uid())
    )
    OR (
      privacy = 'contacts'
      AND EXISTS (SELECT 1 FROM contacts c WHERE c.user_id = statuses.user_id AND c.contact_id = auth.uid())
    )
    OR (
      privacy = 'selected'
      AND auth.uid() = ANY(allowed_users)
    )
    OR (
      privacy = 'excluded'
      AND auth.uid() <> statuses.user_id
      AND NOT (auth.uid() = ANY(excluded_users))
    )
  );

DROP POLICY IF EXISTS "statuses_insert_own" ON statuses;
CREATE POLICY "statuses_insert_own" ON statuses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "statuses_delete_own" ON statuses;
CREATE POLICY "statuses_delete_own" ON statuses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- STATUS VIEWS
DROP POLICY IF EXISTS "status_views_select_owner" ON status_views;
CREATE POLICY "status_views_select_owner" ON status_views FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM statuses s WHERE s.id = status_views.status_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "status_views_insert_own" ON status_views;
CREATE POLICY "status_views_insert_own" ON status_views FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- CALLS
DROP POLICY IF EXISTS "calls_select_parties" ON calls;
CREATE POLICY "calls_select_parties" ON calls FOR SELECT
  TO authenticated USING (auth.uid() = caller_id OR auth.uid() = callee_id);

DROP POLICY IF EXISTS "calls_insert_caller" ON calls;
CREATE POLICY "calls_insert_caller" ON calls FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = caller_id);

DROP POLICY IF EXISTS "calls_update_parties" ON calls;
CREATE POLICY "calls_update_parties" ON calls FOR UPDATE
  TO authenticated USING (auth.uid() = caller_id OR auth.uid() = callee_id)
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- USER SETTINGS
DROP POLICY IF EXISTS "settings_select_own" ON user_settings;
CREATE POLICY "settings_select_own" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "settings_insert_own" ON user_settings;
CREATE POLICY "settings_insert_own" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "settings_update_own" ON user_settings;
CREATE POLICY "settings_update_own" ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI CONVERSATIONS
DROP POLICY IF EXISTS "ai_select_own" ON ai_conversations;
CREATE POLICY "ai_select_own" ON ai_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_insert_own" ON ai_conversations;
CREATE POLICY "ai_insert_own" ON ai_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_delete_own" ON ai_conversations;
CREATE POLICY "ai_delete_own" ON ai_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ========== STORAGE BUCKETS ==========
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('voice', 'voice', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('statuses', 'statuses', true) ON CONFLICT (id) DO NOTHING;

-- ========== STORAGE POLICIES ==========
-- Avatars
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

-- ========== REALTIME PUBLICATION ==========
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE status_views;
