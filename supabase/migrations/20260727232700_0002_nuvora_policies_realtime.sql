/*
# NUVORA Core Schema - Part 2: RLS Policies + Realtime

Applies row-level security policies to all NUVORA tables and enables realtime.
*/

-- ========== PROFILES ==========
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

-- ========== CONTACTS ==========
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

-- ========== BLOCKED USERS ==========
DROP POLICY IF EXISTS "blocked_select_own" ON blocked_users;
CREATE POLICY "blocked_select_own" ON blocked_users FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "blocked_insert_own" ON blocked_users;
CREATE POLICY "blocked_insert_own" ON blocked_users FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "blocked_delete_own" ON blocked_users;
CREATE POLICY "blocked_delete_own" ON blocked_users FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ========== CHATS ==========
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

-- ========== CHAT MEMBERS ==========
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

-- ========== MESSAGES ==========
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

-- ========== REACTIONS ==========
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

-- ========== STATUSES ==========
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

-- ========== STATUS VIEWS ==========
DROP POLICY IF EXISTS "status_views_select_owner" ON status_views;
CREATE POLICY "status_views_select_owner" ON status_views FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM statuses s WHERE s.id = status_views.status_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "status_views_insert_own" ON status_views;
CREATE POLICY "status_views_insert_own" ON status_views FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ========== CALLS ==========
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

-- ========== NOTIFICATIONS ==========
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ========== USER SETTINGS ==========
DROP POLICY IF EXISTS "settings_select_own" ON user_settings;
CREATE POLICY "settings_select_own" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "settings_insert_own" ON user_settings;
CREATE POLICY "settings_insert_own" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "settings_update_own" ON user_settings;
CREATE POLICY "settings_update_own" ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========== AI CONVERSATIONS ==========
DROP POLICY IF EXISTS "ai_select_own" ON ai_conversations;
CREATE POLICY "ai_select_own" ON ai_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_insert_own" ON ai_conversations;
CREATE POLICY "ai_insert_own" ON ai_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_delete_own" ON ai_conversations;
CREATE POLICY "ai_delete_own" ON ai_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ========== REALTIME PUBLICATION ==========
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE status_views;
