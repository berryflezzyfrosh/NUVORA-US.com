// js/contacts.js
import { supabase } from './lib/supabase.js';
import { state, emit } from './lib/state.js';

export async function loadContacts() {
  if (!state.user) return;
  const { data } = await supabase
    .from('contacts')
    .select(`
      *,
      profiles!contacts_contact_id_fkey(id, username, display_name, avatar_url, bio, is_online, last_seen)
    `)
    .eq('user_id', state.user.id)
    .order('created_at', { ascending: false });
  state.contacts = data || [];
  emit('contacts', state.contacts);
  return state.contacts;
}
