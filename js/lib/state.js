// js/lib/state.js
// Central app state with pub/sub
import { supabase } from './supabase.js';

const state = {
  user: null,           // auth user
  profile: null,        // profiles row
  settings: null,       // user_settings row
  contacts: [],         // contacts rows
  chats: [],            // chats rows (with last message + member info)
  activeChatId: null,
  activeView: 'chats',  // chats | status | calls | contacts | nuvo | settings
  callState: null,      // active call info
  statusUpdates: [],
  notifications: [],
  blocked: [],
  calls: [],
};

export { state };
export function getState() { return state; }

const listeners = new Map();

export function setState(patch) {
  Object.assign(state, patch);
  emit('state', state);
}

export function subscribe(key, cb) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(cb);
  return () => listeners.get(key)?.delete(cb);
}

export function emit(key, payload) {
  listeners.get(key)?.forEach(cb => cb(payload));
}

export async function loadProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  state.user = user;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  state.profile = profile;
  const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
  state.settings = settings;
  emit('profile', state.profile);
  return profile;
}

export async function ensureProfile() {
  if (state.profile) return state.profile;
  return loadProfile();
}

export async function loadSettings() {
  if (!state.user) return;
  const { data } = await supabase.from('user_settings').select('*').eq('user_id', state.user.id).maybeSingle();
  if (data) state.settings = data;
  else {
    // create default settings
    const { data: created } = await supabase.from('user_settings').insert({ user_id: state.user.id }).select().maybeSingle();
    state.settings = created;
  }
  emit('settings', state.settings);
  applyTheme();
  return state.settings;
}

export function applyTheme() {
  const theme = state.settings?.theme || 'system';
  let resolved = theme;
  if (theme === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', resolved);
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.settings?.theme === 'system') applyTheme();
});
