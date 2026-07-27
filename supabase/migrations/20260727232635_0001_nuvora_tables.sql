/*
# NUVORA Core Schema - Part 1: Tables

Creates all core tables for NUVORA messaging app.
Policies are applied in a follow-up migration after tables exist.
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
