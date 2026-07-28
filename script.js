/* ============================================================
   NUVORA — Global Messaging Application
   Vanilla JavaScript — No frameworks, no build process
   ============================================================ */

/* ============================================================
   CONFIGURATION
   Replace these two values with your own Supabase project:
   1. Go to your Supabase Dashboard → Settings → API
   2. Copy the "Project URL" and "anon public" key
   3. Paste them below
   ============================================================ */
const SUPABASE_URL = 'https://wcktpmbsdamhuprczcrk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indja3RwbWJzZGFtaHVwcmN6Y3JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxODUyNDYsImV4cCI6MjEwMDc2MTI0Nn0.gwfsTYcIdQQDgVcvyQY8unKUMWxDmY-zYZo-s8YxscY';

/* ============================================================
   STATE
   ============================================================ */
const state = {
  user: null,
  profile: null,
  settings: null,
  chats: [],
  activeChat: null,
  activeView: 'chats',
  messages: [],
  contacts: [],
  blocked: [],
  statuses: [],
  notifications: [],
  calls: [],
  aiMessages: [],
  subscriptions: [],
  typingTimeout: null,
  isTyping: false,
  searchQuery: '',
  supabaseReady: false,
  offline: false,
  replyTo: null,
  editingMessage: null,
  recording: null,
  recordingChunks: [],
  recordingTimer: null,
  recordingSeconds: 0,
  callState: null,
  peerConnection: null,
  localStream: null,
  remoteStream: null,
};

/* ============================================================
   SUPABASE CLIENT
   ============================================================ */
let supabase = null;
try {
  if (typeof window !== 'undefined' && window.supabase && SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } }
    });
    state.supabaseReady = true;
  }
} catch (e) {
  console.warn('Supabase init failed:', e);
}

/* ============================================================
   ICONS (inline SVG strings)
   ============================================================ */
const I = {
  chat: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  contacts: '<svg class="icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  group: '<svg class="icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  status: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-dasharray="2 2"/><circle cx="12" cy="12" r="4"/></svg>',
  phone: '<svg class="icon" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  video: '<svg class="icon" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
  ai: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 1 3 3c0 .5-.12.95-.33 1.36A3 3 0 0 1 18 10c0 1.2-.7 2.24-1.73 2.73A3 3 0 0 1 15 18a3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1-1.27-5.27A3 3 0 0 1 6 10a3 3 0 0 1 3.33-5.64A3 3 0 0 1 12 2z"/><circle cx="12" cy="10" r="1"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></svg>',
  bell: '<svg class="icon" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  settings: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  search: '<svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  send: '<svg class="icon" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  paperclip: '<svg class="icon" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  mic: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  smile: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  more: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
  back: '<svg class="icon" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  checkDouble: '<svg class="icon" viewBox="0 0 24 24"><polyline points="18 6 7 17 2 12"/><polyline points="22 10 13 19 11 17"/></svg>',
  reply: '<svg class="icon" viewBox="0 0 24 24"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>',
  forward: '<svg class="icon" viewBox="0 0 24 24"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>',
  edit: '<svg class="icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  star: '<svg class="icon" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  starFilled: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  pin: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>',
  copy: '<svg class="icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  x: '<svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  plus: '<svg class="icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  play: '<svg class="icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  pause: '<svg class="icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  stop: '<svg class="icon" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
  camera: '<svg class="icon" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  image: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  file: '<svg class="icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  logout: '<svg class="icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  moon: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  sun: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  shield: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  user: '<svg class="icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  info: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  block: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
  archive: '<svg class="icon" viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  mute: '<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
  delete: '<svg class="icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  download: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  phoneOff: '<svg class="icon" viewBox="0 0 24 24"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>',
  micOff: '<svg class="icon" viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  camOff: '<svg class="icon" viewBox="0 0 24 24"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
};

/* ============================================================
   UTILITIES
   ============================================================ */
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'onclick') e.addEventListener('click', attrs[k]);
      else if (k === 'style') e.setAttribute('style', attrs[k]);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
  }
  if (children) {
    if (typeof children === 'string') e.textContent = children;
    else if (Array.isArray(children)) children.forEach(c => c && e.append(c));
    else e.append(children);
  }
  return e;
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function toast(msg, type) {
  const t = el('div', { class: 'toast ' + (type || ''), text: msg });
  $('#toast-container').append(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 86400000;
  if (diff < 1) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 2) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(1) + ' GB';
}
function avatarHTML(profile, size) {
  const sz = size || 'md';
  if (profile && profile.avatar_url) {
    return `<div class="avatar avatar-${sz}"><img src="${escapeHtml(profile.avatar_url)}" alt="" /></div>`;
  }
  const name = (profile && (profile.display_name || profile.username)) || '?';
  const initial = name[0].toUpperCase();
  return `<div class="avatar avatar-${sz}">${escapeHtml(initial)}</div>`;
}
function getInitials(name) {
  if (!name) return '?';
  return name[0].toUpperCase();
}
function showModal(content, large) {
  const overlay = el('div', { class: 'modal-overlay' });
  const modal = el('div', { class: 'modal' + (large ? ' modal-lg' : '') });
  modal.append(content);
  overlay.append(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  $('#modal-root').append(overlay);
  return { overlay, modal };
}
function closeModal(overlay) { if (overlay) overlay.remove(); }
function confirmDialog(message, onConfirm, onCancel) {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Confirm' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, [el('p', { text: message })]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', text: 'Cancel', onclick: () => { if (onCancel) onCancel(); closeModal(overlay); } }),
      el('button', { class: 'btn btn-danger', text: 'Confirm', onclick: () => { if (onConfirm) onConfirm(); closeModal(overlay); } }),
    ]),
  ]);
  const overlay = showModal(content);
  return overlay;
}
const NUVORA_LOGO_SVG = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="nvGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop stop-color="#0ea5e9"/><stop offset="1" stop-color="#14b8a6"/></linearGradient></defs><path d="M32 4C16.5 4 4 14.7 4 28c0 7.5 3.8 14.2 9.8 18.7L12 60l14-5.2c1.9.4 3.9.6 6 .6 15.5 0 28-10.7 28-24S47.5 4 32 4z" fill="url(#nvGrad)"/><path d="M22 24c0-1.1.9-2 2-2h3.5c.9 0 1.7.6 1.9 1.5L32 34l5-22c.2-.9 1-1.5 1.9-1.5H42c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2s-2-.9-2-2V18l-4.5 20c-.2.9-1 1.5-1.9 1.5h-3.2c-.9 0-1.7-.6-1.9-1.5L24 18v22c0 1.1-.9 2-2 2s-2-.9-2-2V24z" fill="#fff"/></svg>`;

/* ============================================================
   THEME
   ============================================================ */
function applyTheme(theme) {
  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

/* ============================================================
   AUTH
   ============================================================ */
async function initAuth() {
  if (!supabase) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      state.user = session.user;
      await loadProfile();
      await loadSettings();
      applyTheme(state.settings ? state.settings.theme : 'system');
    }
    supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_IN' && session) {
          state.user = session.user;
          await loadProfile();
          await loadSettings();
          applyTheme(state.settings ? state.settings.theme : 'system');
          renderApp();
        } else if (event === 'SIGNED_OUT') {
          cleanupSubscriptions();
          state.user = null;
          state.profile = null;
          state.settings = null;
          renderAuth();
        }
      })();
    });
  } catch (e) {
    console.warn('Auth init failed:', e);
  }
}

async function loadProfile() {
  if (!supabase || !state.user) return;
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
    if (error) throw error;
    if (data) {
      state.profile = data;
    } else {
      // Profile doesn't exist yet — create it
      const newProfile = {
        id: state.user.id,
        username: (state.user.email || '').split('@')[0],
        display_name: (state.user.email || '').split('@')[0],
      };
      const { data: inserted, error: insErr } = await supabase.from('profiles').insert(newProfile).select().maybeSingle();
      if (!insErr && inserted) state.profile = inserted;
      // Also create settings
      await supabase.from('user_settings').insert({ user_id: state.user.id }).then();
    }
    // Update online status
    await supabase.from('profiles').update({ online: true, last_seen: new Date().toISOString() }).eq('id', state.user.id).then();
  } catch (e) {
    console.warn('Load profile failed:', e);
  }
}

async function loadSettings() {
  if (!supabase || !state.user) return;
  try {
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', state.user.id).maybeSingle();
    if (error) throw error;
    state.settings = data || { theme: 'system', notifications_enabled: true, read_receipts: true, typing_indicators: true, last_seen_visible: true };
  } catch (e) {
    console.warn('Load settings failed:', e);
    state.settings = { theme: 'system', notifications_enabled: true, read_receipts: true, typing_indicators: true, last_seen_visible: true };
  }
}

function renderAuth() {
  const app = $('#app');
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo">${NUVORA_LOGO_SVG}<h1>NUVORA</h1></div>
        <p class="auth-subtitle">Global messaging, reimagined.</p>
        ${!state.supabaseReady ? '<div class="setup-banner"><svg class="icon" viewBox="0 0 24 24" style="width:18px;height:18px;"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg> Setup required — open script.js and add your Supabase URL and key</div>' : ''}
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Sign In</button>
          <button class="auth-tab" data-tab="signup">Create Account</button>
        </div>
        <div class="auth-form" id="auth-form-container"></div>
        <div id="auth-error" class="auth-error hidden"></div>
      </div>
    </div>
  `;
  renderAuthForm('login');
  $$('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderAuthForm(tab.dataset.tab);
    });
  });
}

function renderAuthForm(mode) {
  const container = $('#auth-form-container');
  const errDiv = $('#auth-error');
  errDiv.classList.add('hidden');
  if (mode === 'login') {
    container.innerHTML = `
      <div class="input-group">
        <label class="input-label">Email</label>
        <input class="input" type="email" id="auth-email" placeholder="you@example.com" autocomplete="email" />
      </div>
      <div class="input-group">
        <label class="input-label">Password</label>
        <input class="input" type="password" id="auth-password" placeholder="Your password" autocomplete="current-password" />
      </div>
      <button class="btn btn-primary btn-block" id="auth-submit">Sign In</button>
      <button class="btn btn-ghost btn-block" id="auth-forgot">Forgot password?</button>
    `;
    $('#auth-submit').addEventListener('click', handleLogin);
    $('#auth-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    $('#auth-forgot').addEventListener('click', handleForgotPassword);
  } else {
    container.innerHTML = `
      <div class="input-group">
        <label class="input-label">Display Name</label>
        <input class="input" type="text" id="auth-name" placeholder="Your name" />
      </div>
      <div class="input-group">
        <label class="input-label">Username</label>
        <input class="input" type="text" id="auth-username" placeholder="username" />
      </div>
      <div class="input-group">
        <label class="input-label">Email</label>
        <input class="input" type="email" id="auth-email" placeholder="you@example.com" autocomplete="email" />
      </div>
      <div class="input-group">
        <label class="input-label">Password</label>
        <input class="input" type="password" id="auth-password" placeholder="At least 6 characters" autocomplete="new-password" />
      </div>
      <button class="btn btn-primary btn-block" id="auth-submit">Create Account</button>
    `;
    $('#auth-submit').addEventListener('click', handleSignup);
    $('#auth-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleSignup(); });
  }
}

function showAuthError(msg) {
  const e = $('#auth-error');
  e.textContent = msg;
  e.classList.remove('hidden');
}

async function handleLogin() {
  const email = $('#auth-email')?.value.trim();
  const password = $('#auth-password')?.value;
  if (!email || !password) { showAuthError('Please enter your email and password.'); return; }
  if (!supabase) { showAuthError('Supabase is not configured. Please add your credentials in script.js.'); return; }
  const btn = $('#auth-submit');
  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { showAuthError(error.message); btn.disabled = false; btn.textContent = 'Sign In'; return; }
    // onAuthStateChange will handle the rest
  } catch (e) {
    showAuthError('Could not sign in. Please check your connection.');
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function handleSignup() {
  const email = $('#auth-email')?.value.trim();
  const password = $('#auth-password')?.value;
  const displayName = $('#auth-name')?.value.trim();
  const username = $('#auth-username')?.value.trim();
  if (!email || !password) { showAuthError('Please fill in all fields.'); return; }
  if (password.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }
  if (!supabase) { showAuthError('Supabase is not configured. Please add your credentials in script.js.'); return; }
  const btn = $('#auth-submit');
  btn.disabled = true; btn.textContent = 'Creating account...';
  try {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName || username, username: username } }
    });
    if (error) { showAuthError(error.message); btn.disabled = false; btn.textContent = 'Create Account'; return; }
    if (data.user) {
      // Create profile
      await supabase.from('profiles').insert({
        id: data.user.id,
        username: username || email.split('@')[0],
        display_name: displayName || username || email.split('@')[0],
      }).then();
      await supabase.from('user_settings').insert({ user_id: data.user.id }).then();
      toast('Account created! Welcome to NUVORA.', 'success');
    }
  } catch (e) {
    showAuthError('Could not create account. Please try again.');
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

async function handleForgotPassword() {
  const email = $('#auth-email')?.value.trim();
  if (!email) { showAuthError('Enter your email above first, then click forgot password.'); return; }
  if (!supabase) return;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) showAuthError(error.message);
    else toast('Password reset email sent!', 'success');
  } catch (e) { showAuthError('Could not send reset email.'); }
}

async function handleLogout() {
  if (!supabase) return;
  try {
    // Set offline
    await supabase.from('profiles').update({ online: false, last_seen: new Date().toISOString() }).eq('id', state.user.id).then();
  } catch (e) {}
  cleanupSubscriptions();
  await supabase.auth.signOut();
}

/* ============================================================
   APP SHELL
   ============================================================ */
function renderApp() {
  const app = $('#app');
  if (!state.user || !state.profile) { renderAuth(); return; }

  app.innerHTML = `
    <div class="app-shell">
      <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">${NUVORA_LOGO_SVG} NUVORA</div>
          <button class="btn-icon" id="btn-logout" title="Sign out">${I.logout}</button>
        </div>
        <div class="sidebar-search">
          <div class="search-wrap">${I.search}<input class="input" type="text" id="search-input" placeholder="Search..." /></div>
        </div>
        <div class="sidebar-nav" id="sidebar-nav">
          <button class="nav-item active" data-view="chats">${I.chat}<span>Chats</span></button>
          <button class="nav-item" data-view="status">${I.status}<span>Status</span></button>
          <button class="nav-item" data-view="calls">${I.phone}<span>Calls</span></button>
          <button class="nav-item" data-view="contacts">${I.contacts}<span>Contacts</span></button>
          <button class="nav-item" data-view="groups">${I.group}<span>Groups</span></button>
          <button class="nav-item" data-view="nuvo">${I.ai}<span>NUVO</span></button>
          <button class="nav-item" data-view="notifications">${I.bell}<span>Alerts</span></button>
          <button class="nav-item" data-view="settings">${I.settings}<span>Settings</span></button>
        </div>
        <div class="list-area" id="list-area"></div>
      </div>
      <div class="main-area" id="main-area">
        <div class="empty-state">
          ${NUVORA_LOGO_SVG}
          <h2>Welcome to NUVORA</h2>
          <p>Select a chat or start a new conversation to begin messaging.</p>
        </div>
      </div>
    </div>
    <div class="bottom-nav" id="bottom-nav">
      <button class="bottom-nav-item active" data-view="chats">${I.chat}<span>Chats</span></button>
      <button class="bottom-nav-item" data-view="status">${I.status}<span>Status</span></button>
      <button class="bottom-nav-item" data-view="calls">${I.phone}<span>Calls</span></button>
      <button class="bottom-nav-item" data-view="contacts">${I.contacts}<span>Contacts</span></button>
      <button class="bottom-nav-item" data-view="settings">${I.settings}<span>More</span></button>
    </div>
  `;

  // Wire up nav
  $$('.nav-item, .bottom-nav-item').forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });
  $('#btn-logout').addEventListener('click', () => confirmDialog('Sign out of NUVORA?', handleLogout));
  $('#search-input').addEventListener('input', e => {
    state.searchQuery = e.target.value.toLowerCase();
    renderListArea();
  });

  // Load data
  loadChats();
  loadContacts();
  loadStatuses();
  loadCalls();
  loadNotifications();
  subscribeRealtime();

  // Default view
  switchView('chats');
}

function switchView(view) {
  state.activeView = view;
  $$('.nav-item, .bottom-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  renderListArea();
  renderMainArea();
}

/* ============================================================
   CHAT LIST
   ============================================================ */
async function loadChats() {
  if (!supabase || !state.user) return;
  try {
    const { data: memberships } = await supabase.from('chat_members').select('chat_id').eq('user_id', state.user.id);
    if (!memberships || memberships.length === 0) { state.chats = []; renderListArea(); return; }
    const chatIds = memberships.map(m => m.chat_id);
    const { data: chats, error } = await supabase.from('chats').select('*').in('id', chatIds).order('updated_at', { ascending: false });
    if (error) throw error;
    state.chats = chats || [];
    // Load last message for each chat
    for (const chat of state.chats) {
      const { data: lastMsg } = await supabase.from('messages').select('*').eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      chat.last_message = lastMsg || null;
      // Load member info for private chats
      if (chat.type === 'private') {
        const { data: members } = await supabase.from('chat_members').select('user_id').eq('chat_id', chat.id).neq('user_id', state.user.id);
        if (members && members.length > 0) {
          const { data: otherProfile } = await supabase.from('profiles').select('*').eq('id', members[0].user_id).maybeSingle();
          chat.other_profile = otherProfile;
        }
      }
    }
    renderListArea();
  } catch (e) {
    console.warn('Load chats failed:', e);
    state.offline = true;
    renderListArea();
  }
}

function renderListArea() {
  const area = $('#list-area');
  if (!area) return;
  const view = state.activeView;

  switch (view) {
    case 'chats': renderChatList(area); break;
    case 'status': renderStatusList(area); break;
    case 'calls': renderCallList(area); break;
    case 'contacts': renderContactsList(area); break;
    case 'groups': renderGroupsList(area); break;
    case 'nuvo': renderNuvoList(area); break;
    case 'notifications': renderNotificationsList(area); break;
    case 'settings': renderSettingsList(area); break;
    default: renderChatList(area);
  }
}

function renderChatList(area) {
  let chats = state.chats.filter(c => !c.archived);
  if (state.searchQuery) {
    chats = chats.filter(c => {
      const name = c.type === 'private' ? (c.other_profile?.display_name || c.other_profile?.username || c.name || '') : (c.name || '');
      return name.toLowerCase().includes(state.searchQuery);
    });
  }
  if (chats.length === 0) {
    area.innerHTML = `<div class="list-empty">${I.chat}<p>No chats yet. Start a new conversation from Contacts.</p></div>`;
    return;
  }
  area.innerHTML = chats.map(chat => {
    const name = chat.type === 'private' ? (chat.other_profile?.display_name || chat.other_profile?.username || chat.name || 'Unknown') : (chat.name || 'Group');
    const avatar = chat.type === 'private' ? avatarHTML(chat.other_profile, 'md') : `<div class="avatar avatar-md">${getInitials(chat.name)}</div>`;
    const lastMsg = chat.last_message;
    let preview = 'No messages yet';
    let timeStr = '';
    if (lastMsg) {
      preview = lastMsg.body || (lastMsg.message_type !== 'text' ? `[${lastMsg.message_type}]` : '');
      timeStr = formatDate(lastMsg.created_at);
    }
    const isActive = state.activeChat && state.activeChat.id === chat.id;
    return `<div class="chat-item ${isActive ? 'active' : ''}" data-chat-id="${chat.id}">${avatar}<div class="chat-item-body"><div class="chat-item-top"><span class="chat-item-name">${escapeHtml(name)}</span><span class="chat-item-time">${timeStr}</span></div><div class="chat-item-msg">${escapeHtml(preview)}</div></div></div>`;
  }).join('');
  $$('.chat-item', area).forEach(item => {
    item.addEventListener('click', () => openChat(item.dataset.chatId));
  });
}

/* ============================================================
   CHAT VIEW
   ============================================================ */
async function openChat(chatId) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;
  state.activeChat = chat;
  state.activeView = 'chats';
  renderMainArea();
  renderListArea();
  await loadMessages(chatId);
  // Mark as read
  if (supabase && state.user) {
    try {
      await supabase.from('chat_members').update({ last_read_at: new Date().toISOString() }).eq('chat_id', chatId).eq('user_id', state.user.id);
    } catch (e) {}
  }
  // On mobile, hide sidebar
  if (window.innerWidth <= 768) {
    $('#sidebar').classList.add('hidden-mobile');
  }
}

async function loadMessages(chatId) {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true }).limit(100);
    if (error) throw error;
    state.messages = data || [];
    renderMessages();
  } catch (e) {
    console.warn('Load messages failed:', e);
    state.messages = [];
    renderMessages();
  }
}

function renderMessages() {
  const container = $('#chat-messages');
  if (!container) return;
  if (state.messages.length === 0) {
    container.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted);">No messages yet. Say hello!</div>';
    return;
  }
  container.innerHTML = state.messages.map(msg => renderMessageHTML(msg)).join('');
  container.scrollTop = container.scrollHeight;
  // Wire up context menus
  $$('.msg-bubble', container).forEach(bubble => {
    bubble.addEventListener('contextmenu', e => {
      e.preventDefault();
      showMessageContextMenu(e, bubble.dataset.msgId);
    });
    bubble.addEventListener('touchstart', e => {
      let timer = setTimeout(() => {
        showMessageContextMenu({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, preventDefault: () => {}, stopPropagation: () => {} }, bubble.dataset.msgId);
      }, 500);
      bubble.addEventListener('touchend', () => clearTimeout(timer), { once: true });
      bubble.addEventListener('touchmove', () => clearTimeout(timer), { once: true });
    });
  });
}

function renderMessageHTML(msg) {
  const isOut = msg.sender_id === state.user?.id;
  const isDeleted = msg.deleted_for_everyone;
  const isStarred = msg.starred_by && state.user && msg.starred_by.includes(state.user.id);

  let inner = '';
  // Reply quote
  if (msg.reply_to_id) {
    const replied = state.messages.find(m => m.id === msg.reply_to_id);
    if (replied) {
      inner += `<div class="msg-reply-quote">${escapeHtml((replied.body || '[Attachment]').slice(0, 80))}</div>`;
    }
  }
  // Content
  if (isDeleted) {
    inner += '<span class="msg-deleted">This message was deleted</span>';
  } else if (msg.message_type === 'text') {
    inner += `<div class="msg-text">${escapeHtml(msg.body || '')}</div>`;
  } else if (msg.attachment_url) {
    if (msg.message_type === 'image') {
      inner += `<div class="msg-attachment"><img src="${escapeHtml(msg.attachment_url)}" alt="image" loading="lazy" /></div>`;
      if (msg.body) inner += `<div class="msg-text">${escapeHtml(msg.body)}</div>`;
    } else if (msg.message_type === 'video') {
      inner += `<div class="msg-attachment"><video src="${escapeHtml(msg.attachment_url)}" controls preload="metadata"></video></div>`;
      if (msg.body) inner += `<div class="msg-text">${escapeHtml(msg.body)}</div>`;
    } else if (msg.message_type === 'audio' || msg.message_type === 'voice') {
      inner += `<div class="voice-msg"><button class="voice-play-btn" data-url="${escapeHtml(msg.attachment_url)}">${I.play}</button><div class="voice-wave">${Array.from({length:20}).map(() => '<div class="voice-bar"></div>').join('')}</div><span class="voice-duration">${msg.body || ''}</span></div>`;
    } else {
      inner += `<div class="msg-attachment-file">${I.file}<div><div>${escapeHtml(msg.attachment_name || 'File')}</div><div class="text-xs text-muted">${formatFileSize(msg.attachment_size || 0)}</div></div></div>`;
    }
  } else {
    inner += `<div class="msg-text">${escapeHtml(msg.body || '')}</div>`;
  }
  // Meta
  let metaHTML = `<span>${formatTime(msg.created_at)}</span>`;
  if (isOut && !isDeleted) {
    metaHTML += `<span class="tick">${I.check}</span>`;
  }
  if (isStarred) metaHTML += `<span class="msg-starred">${I.starFilled}</span>`;
  inner += `<div class="msg-meta">${metaHTML}</div>`;

  const cls = isOut ? 'msg out' : 'msg in';
  return `<div class="${cls}"><div class="msg-bubble" data-msg-id="${msg.id}">${inner}</div></div>`;
}

/* ============================================================
   COMPOSER
   ============================================================ */
function renderChatView() {
  const chat = state.activeChat;
  if (!chat) return;
  const name = chat.type === 'private' ? (chat.other_profile?.display_name || chat.other_profile?.username || chat.name || 'Unknown') : (chat.name || 'Group');
  const avatar = chat.type === 'private' ? avatarHTML(chat.other_profile, 'sm') : `<div class="avatar avatar-sm">${getInitials(chat.name)}</div>`;
  const subText = chat.type === 'private' ? (chat.other_profile?.online ? 'Online' : 'Last seen ' + formatDate(chat.other_profile?.last_seen)) : (chat.description || 'Group chat');

  const main = $('#main-area');
  main.innerHTML = `
    <div class="chat-view">
      <div class="main-header">
        <button class="btn-icon" id="chat-back">${I.back}</button>
        ${avatar}
        <div class="main-header-info">
          <div class="main-header-title">${escapeHtml(name)}</div>
          <div class="main-header-sub">${escapeHtml(subText)}</div>
        </div>
        <button class="btn-icon" id="chat-call" title="Call">${I.phone}</button>
        <button class="btn-icon" id="chat-video" title="Video call">${I.video}</button>
        <button class="btn-icon" id="chat-info" title="Info">${I.info}</button>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="composer" id="composer">
        <button class="composer-btn" id="btn-attach">${I.paperclip}</button>
        <button class="composer-btn" id="btn-emoji">${I.smile}</button>
        <div class="composer-input-wrap">
          <textarea class="composer-input" id="msg-input" placeholder="Type a message..." rows="1"></textarea>
        </div>
        <button class="composer-btn" id="btn-mic">${I.mic}</button>
        <button class="composer-send" id="btn-send">${I.send}</button>
      </div>
    </div>
    <input type="file" id="file-input" hidden />
  `;

  $('#chat-back').addEventListener('click', () => {
    state.activeChat = null;
    $('#sidebar').classList.remove('hidden-mobile');
    renderMainArea();
  });
  $('#chat-info').addEventListener('click', showChatInfo);
  $('#chat-call').addEventListener('click', () => startCall('voice'));
  $('#chat-video').addEventListener('click', () => startCall('video'));
  $('#btn-send').addEventListener('click', sendMessage);
  $('#btn-attach').addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', handleFileUpload);
  $('#btn-mic').addEventListener('click', startRecording);
  $('#btn-emoji').addEventListener('click', showEmojiPicker);

  const input = $('#msg-input');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    handleTyping();
  });

  renderMessages();
}

async function sendMessage() {
  const input = $('#msg-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text || !supabase || !state.activeChat) return;
  input.value = '';
  input.style.height = 'auto';
  try {
    const msg = {
      chat_id: state.activeChat.id,
      sender_id: state.user.id,
      body: text,
      message_type: 'text',
    };
    if (state.replyTo) { msg.reply_to_id = state.replyTo.id; state.replyTo = null; }
    const { data, error } = await supabase.from('messages').insert(msg).select().maybeSingle();
    if (error) throw error;
    // Update chat updated_at
    await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', state.activeChat.id);
    if (data) {
      state.messages.push(data);
      renderMessages();
    }
  } catch (e) {
    toast('Could not send message.', 'error');
    console.warn('Send failed:', e);
  }
}

async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file || !supabase || !state.activeChat) return;
  // Validate
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) { toast('File too large (max 50MB).', 'error'); return; }
  let messageType = 'file';
  if (file.type.startsWith('image/')) messageType = 'image';
  else if (file.type.startsWith('video/')) messageType = 'video';
  else if (file.type.startsWith('audio/')) messageType = 'audio';
  else if (file.type === 'application/pdf') messageType = 'document';
  try {
    const ext = file.name.split('.').pop();
    const path = `uploads/${state.user.id}/${Date.now()}.${ext}`;
    const { data: uploadData, error: uploadErr } = await supabase.storage.from('attachments').upload(path, file);
    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
    const url = urlData.publicUrl;
    const msg = {
      chat_id: state.activeChat.id,
      sender_id: state.user.id,
      body: '',
      message_type: messageType,
      attachment_url: url,
      attachment_name: file.name,
      attachment_size: file.size,
      attachment_mime: file.type,
    };
    const { data: inserted, error: insErr } = await supabase.from('messages').insert(msg).select().maybeSingle();
    if (insErr) throw insErr;
    await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', state.activeChat.id);
    if (inserted) { state.messages.push(inserted); renderMessages(); }
  } catch (e) {
    toast('Could not upload file.', 'error');
    console.warn('Upload failed:', e);
  }
  e.target.value = '';
}

/* ============================================================
   VOICE RECORDING
   ============================================================ */
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.recording = new MediaRecorder(stream);
    state.recordingChunks = [];
    state.recordingSeconds = 0;
    state.recording.ondataavailable = e => { if (e.data.size > 0) state.recordingChunks.push(e.data); };
    state.recording.onstop = sendVoiceMessage;
    state.recording.start();
    state.recordingTimer = setInterval(() => { state.recordingSeconds++; }, 1000);
    showRecordingBar();
  } catch (e) {
    toast('Could not access microphone.', 'error');
  }
}

function showRecordingBar() {
  const composer = $('#composer');
  if (!composer) return;
  composer.innerHTML = `
    <div class="recording-bar" style="width:100%;">
      <button class="btn-icon" id="rec-cancel">${I.x}</button>
      <div class="recording-dot"></div>
      <span class="recording-timer" id="rec-timer">0:00</span>
      <div style="flex:1;"></div>
      <button class="composer-send" id="rec-send">${I.send}</button>
    </div>
  `;
  $('#rec-cancel').addEventListener('click', cancelRecording);
  $('#rec-send').addEventListener('click', stopRecording);
  // Update timer
  const timerEl = $('#rec-timer');
  const updateTimer = setInterval(() => {
    if (!state.recording || state.recording.state === 'inactive') { clearInterval(updateTimer); return; }
    timerEl.textContent = formatDuration(state.recordingSeconds);
  }, 1000);
}

function cancelRecording() {
  if (state.recording && state.recording.state !== 'inactive') {
    state.recording.onstop = null;
    state.recording.stop();
    state.recording.stream.getTracks().forEach(t => t.stop());
  }
  clearInterval(state.recordingTimer);
  state.recording = null;
  state.recordingChunks = [];
  renderChatView();
}

function stopRecording() {
  if (state.recording && state.recording.state !== 'inactive') {
    state.recording.stop();
    state.recording.stream.getTracks().forEach(t => t.stop());
  }
  clearInterval(state.recordingTimer);
}

async function sendVoiceMessage() {
  if (!state.recordingChunks || state.recordingChunks.length === 0) { renderChatView(); return; }
  const blob = new Blob(state.recordingChunks, { type: 'audio/webm' });
  const duration = formatDuration(state.recordingSeconds);
  try {
    const path = `uploads/${state.user.id}/voice_${Date.now()}.webm`;
    const { error: uploadErr } = await supabase.storage.from('attachments').upload(path, blob);
    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
    const msg = {
      chat_id: state.activeChat.id,
      sender_id: state.user.id,
      body: duration,
      message_type: 'voice',
      attachment_url: urlData.publicUrl,
      attachment_name: `voice_${Date.now()}.webm`,
      attachment_size: blob.size,
      attachment_mime: 'audio/webm',
    };
    const { data: inserted, error: insErr } = await supabase.from('messages').insert(msg).select().maybeSingle();
    if (insErr) throw insErr;
    if (inserted) { state.messages.push(inserted); renderMessages(); }
  } catch (e) {
    toast('Could not send voice message.', 'error');
  }
  state.recording = null;
  state.recordingChunks = [];
  renderChatView();
}

/* ============================================================
   MESSAGE CONTEXT MENU
   ============================================================ */
function showMessageContextMenu(e, msgId) {
  const msg = state.messages.find(m => m.id === msgId);
  if (!msg) return;
  const isOut = msg.sender_id === state.user?.id;
  const isDeleted = msg.deleted_for_everyone;
  const isStarred = msg.starred_by && msg.starred_by.includes(state.user.id);

  // Remove existing
  $('.context-menu')?.remove();
  $('.reaction-picker')?.remove();

  const items = [];
  if (!isDeleted) {
    items.push({ label: 'Reply', icon: I.reply, action: () => { state.replyTo = msg; renderChatView(); } });
    items.push({ label: 'React', icon: I.smile, action: () => showReactionPicker(e, msg) });
    items.push({ label: 'Copy', icon: I.copy, action: () => { navigator.clipboard.writeText(msg.body || msg.attachment_name || ''); toast('Copied', 'success'); } });
    items.push({ label: 'Forward', icon: I.forward, action: () => showForwardModal(msg) });
    items.push({ label: isStarred ? 'Unstar' : 'Star', icon: isStarred ? I.starFilled : I.star, action: () => toggleStar(msg) });
  }
  if (isOut && !isDeleted) {
    items.push({ divider: true });
    items.push({ label: 'Edit', icon: I.edit, action: () => showEditMessageModal(msg) });
  }
  items.push({ divider: true });
  items.push({ label: 'Delete for me', icon: I.trash, danger: true, action: () => deleteMessageForMe(msg) });
  if (isOut && !isDeleted) {
    items.push({ label: 'Delete for everyone', icon: I.trash, danger: true, action: () => deleteMessageForEveryone(msg) });
  }

  const menu = el('div', { class: 'context-menu', style: `top:${e.clientY}px;left:${e.clientX}px;` });
  let html = '';
  items.forEach((it, i) => {
    if (it.divider) html += '<div class="context-menu-divider"></div>';
    else html += `<div class="context-menu-item ${it.danger ? 'danger' : ''}" data-idx="${i}">${it.icon}<span>${it.label}</span></div>`;
  });
  menu.innerHTML = html;
  document.body.append(menu);
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
  $$('.context-menu-item', menu).forEach(mi => {
    mi.addEventListener('click', () => {
      const idx = parseInt(mi.dataset.idx);
      menu.remove();
      items[idx].action();
    });
  });
  setTimeout(() => {
    document.addEventListener('click', function close() { menu.remove(); document.removeEventListener('click', close); });
  }, 100);
}

function showReactionPicker(e, msg) {
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const picker = el('div', { class: 'reaction-picker', style: `top:${Math.max(e.clientY - 50, 10)}px;left:${e.clientX}px;` });
  emojis.forEach(em => {
    const cell = el('div', { class: 'emoji-cell', text: em });
    cell.addEventListener('click', () => { toggleReaction(msg, em); picker.remove(); });
    picker.append(cell);
  });
  document.body.append(picker);
  setTimeout(() => {
    document.addEventListener('click', function close() { picker.remove(); document.removeEventListener('click', close); });
  }, 100);
}

async function toggleReaction(msg, emoji) {
  if (!supabase) return;
  try {
    // Check if user already reacted with this emoji
    const { data: existing } = await supabase.from('reactions').select('*').eq('message_id', msg.id).eq('user_id', state.user.id).eq('emoji', emoji).maybeSingle();
    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('reactions').insert({ message_id: msg.id, user_id: state.user.id, emoji });
    }
  } catch (e) { toast('Could not react.', 'error'); }
}

async function toggleStar(msg) {
  if (!supabase) return;
  try {
    let starred = msg.starred_by || [];
    if (starred.includes(state.user.id)) {
      starred = starred.filter(id => id !== state.user.id);
    } else {
      starred = [...starred, state.user.id];
    }
    const { error } = await supabase.from('messages').update({ starred_by: starred }).eq('id', msg.id);
    if (error) throw error;
    msg.starred_by = starred;
    renderMessages();
  } catch (e) { toast('Could not star message.', 'error'); }
}

function showEditMessageModal(msg) {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Edit Message' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, [el('textarea', { class: 'textarea', id: 'edit-msg-input', html: escapeHtml(msg.body) })]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', text: 'Cancel', onclick: () => closeModal(overlay) }),
      el('button', { class: 'btn btn-primary', text: 'Save', onclick: async () => {
        const newText = $('#edit-msg-input').value.trim();
        if (newText && newText !== msg.body) {
          try {
            await supabase.from('messages').update({ body: newText, edited_at: new Date().toISOString() }).eq('id', msg.id);
            msg.body = newText; msg.edited_at = new Date().toISOString();
            renderMessages();
          } catch (e) { toast('Could not edit.', 'error'); }
        }
        closeModal(overlay);
      }}),
    ]),
  ]);
  const overlay = showModal(content);
}

function showForwardModal(msg) {
  const otherChats = state.chats.filter(c => c.id !== state.activeChat?.id);
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Forward To' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { id: 'forward-list' }),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', text: 'Cancel', onclick: () => closeModal(overlay) }),
      el('button', { class: 'btn btn-primary', text: 'Forward', onclick: async () => {
        const selected = $$('.forward-check:checked').map(cb => cb.dataset.chatId);
        if (selected.length === 0) { toast('Select at least one chat', 'error'); return; }
        for (const chatId of selected) {
          try {
            await supabase.from('messages').insert({
              chat_id: chatId,
              sender_id: state.user.id,
              body: msg.body,
              message_type: msg.message_type,
              attachment_url: msg.attachment_url,
              attachment_name: msg.attachment_name,
              attachment_size: msg.attachment_size,
              attachment_mime: msg.attachment_mime,
              forwarded_from: msg.sender_id,
            });
          } catch (e) {}
        }
        toast('Message forwarded', 'success');
        closeModal(overlay);
      }}),
    ]),
  ]);
  const overlay = showModal(content);
  const list = $('#forward-list', content);
  list.innerHTML = otherChats.map(c => {
    const name = c.type === 'private' ? (c.other_profile?.display_name || c.other_profile?.username || c.name || 'Unknown') : (c.name || 'Group');
    return `<div class="member-item" data-chat-id="${c.id}"><div class="avatar avatar-sm">${getInitials(name)}</div><div class="member-info"><div class="member-name">${escapeHtml(name)}</div></div><input type="checkbox" class="forward-check" data-chat-id="${c.id}" /></div>`;
  }).join('');
  $$('.forward-check', list).forEach(cb => cb.addEventListener('click', e => e.stopPropagation()));
  $$('.member-item', list).forEach(item => item.addEventListener('click', () => {
    const cb = item.querySelector('.forward-check');
    cb.checked = !cb.checked;
  }));
}

async function deleteMessageForMe(msg) {
  // For simplicity, just remove from local state (soft delete could be added)
  state.messages = state.messages.filter(m => m.id !== msg.id);
  renderMessages();
}

async function deleteMessageForEveryone(msg) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('messages').update({ deleted_for_everyone: true, body: null, attachment_url: null }).eq('id', msg.id);
    if (error) throw error;
    msg.deleted_for_everyone = true; msg.body = null; msg.attachment_url = null;
    renderMessages();
  } catch (e) { toast('Could not delete.', 'error'); }
}

/* ============================================================
   TYPING INDICATOR
   ============================================================ */
let typingChannel = null;
function handleTyping() {
  if (!supabase || !state.activeChat) return;
  if (!state.isTyping) {
    state.isTyping = true;
    try {
      supabase.channel('typing-' + state.activeChat.id).send({ type: 'broadcast', event: 'typing', payload: { user_id: state.user.id, typing: true } });
    } catch (e) {}
  }
  clearTimeout(state.typingTimeout);
  state.typingTimeout = setTimeout(() => {
    state.isTyping = false;
    try {
      supabase.channel('typing-' + state.activeChat.id).send({ type: 'broadcast', event: 'typing', payload: { user_id: state.user.id, typing: false } });
    } catch (e) {}
  }, 2000);
}

/* ============================================================
   EMOJI PICKER
   ============================================================ */
function showEmojiPicker() {
  const emojis = ['😀','😄','😁','😊','😍','😘','🥰','😎','🤔','😂','🤣','😭','😅','😉','🙃','😇','🥳','😴','🤤','😋','🤩','🥺','😏','😒','😞','😔','😟','😠','🥵','🥶','😱','🤯','🤗','🤝','👋','👍','👎','👏','🙌','🙏','💪','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','✨','🔥','⭐','🌟','💫','🎉','🎊','🎁','💯'];
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Emoji' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body', style: 'display:flex;flex-wrap:wrap;gap:4px;' }, emojis.map(em => {
      const btn = el('button', { class: 'btn btn-ghost', style: 'font-size:24px;padding:4px 8px;', text: em, onclick: () => {
        const input = $('#msg-input');
        if (input) { input.value += em; input.focus(); }
        closeModal(overlay);
      }});
      return btn;
    })),
  ]);
  const overlay = showModal(content);
}

/* ============================================================
   CHAT INFO
   ============================================================ */
function showChatInfo() {
  const chat = state.activeChat;
  if (!chat) return;
  const name = chat.type === 'private' ? (chat.other_profile?.display_name || chat.other_profile?.username || chat.name || 'Unknown') : (chat.name || 'Group');
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Chat Info' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { class: 'profile-view' }, [
        chat.type === 'private' ? el('div', { html: avatarHTML(chat.other_profile, 'xl') }) : el('div', { class: 'avatar avatar-xl', text: getInitials(chat.name) }),
        el('h2', { style: 'font-size:22px;font-weight:700;', text: name }),
        chat.type === 'private' ? el('p', { class: 'text-muted', text: chat.other_profile?.bio || 'No bio' }) : el('p', { class: 'text-muted', text: chat.description || 'Group chat' }),
      ]),
      chat.type === 'private' && chat.other_profile ? el('div', {}, [
        chat.other_profile.username ? el('div', { class: 'profile-info-row' }, [el('div', { class: 'profile-info-label', text: 'Username' }), el('div', { class: 'profile-info-value', text: '@' + chat.other_profile.username })]) : null,
        el('div', { class: 'profile-info-row' }, [el('div', { class: 'profile-info-label', text: 'Status' }), el('div', { class: 'profile-info-value', text: chat.other_profile.online ? 'Online' : 'Offline' })]),
      ]) : null,
    ]),
  ]);
  const overlay = showModal(content);
}

/* ============================================================
   STATUS
   ============================================================ */
async function loadStatuses() {
  if (!supabase || !state.user) return;
  try {
    const { data, error } = await supabase.from('statuses').select('*').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
    if (error) throw error;
    state.statuses = data || [];
  } catch (e) {
    console.warn('Load statuses failed:', e);
    state.statuses = [];
  }
}

function renderStatusList(area) {
  area.innerHTML = `
    <div class="list-empty" id="status-empty">
      ${I.status}
      <p>No status updates. Tap the button below to add one.</p>
    </div>
    <button class="fab" id="fab-status">${I.plus}</button>
  `;
  const myStatuses = state.statuses.filter(s => s.user_id === state.user?.id);
  const otherStatuses = state.statuses.filter(s => s.user_id !== state.user?.id);
  let html = '';
  if (myStatuses.length > 0 || state.user) {
    html += `<div class="status-item" data-action="add-status"><div class="status-ring ${myStatuses.length > 0 ? '' : 'viewed'}">${state.profile?.avatar_url ? `<div class="avatar avatar-md"><img src="${escapeHtml(state.profile.avatar_url)}" /></div>` : `<div class="avatar avatar-md">${getInitials(state.profile?.display_name)}</div>`}</div><div class="chat-item-body"><div class="chat-item-name">My Status</div><div class="chat-item-msg">${myStatuses.length > 0 ? 'Tap to view' : 'Tap to add status'}</div></div></div>`;
  }
  if (otherStatuses.length > 0) {
    html += otherStatuses.map(s => `<div class="status-item" data-status-id="${s.id}"><div class="status-ring"><div class="avatar avatar-md">${getInitials('U')}</div></div><div class="chat-item-body"><div class="chat-item-name">Status</div><div class="chat-item-msg">${escapeHtml(s.body || s.caption || 'Status update')}</div></div></div>`).join('');
  }
  if (html) area.querySelector('#status-empty')?.remove();
  area.insertAdjacentHTML('afterbegin', html);
  $('#fab-status').addEventListener('click', showAddStatusModal);
  $$('[data-action="add-status"]', area).forEach(el => el.addEventListener('click', showAddStatusModal));
}

function showAddStatusModal() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Add Status' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Text Status' }),
        el('textarea', { class: 'textarea', id: 'status-text', placeholder: "What's on your mind?" }),
      ]),
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Privacy' }),
        el('select', { class: 'select', id: 'status-privacy' }, [
          el('option', { value: 'public', text: 'Public' }),
          el('option', { value: 'contacts', text: 'Contacts only' }),
          el('option', { value: 'private', text: 'Private' }),
        ]),
      ]),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', text: 'Cancel', onclick: () => closeModal(overlay) }),
      el('button', { class: 'btn btn-primary', text: 'Post', onclick: async () => {
        const text = $('#status-text').value.trim();
        const privacy = $('#status-privacy').value;
        if (!text) { toast('Enter some text', 'error'); return; }
        try {
          await supabase.from('statuses').insert({ user_id: state.user.id, content_type: 'text', body: text, privacy, background_color: '#0ea5e9' });
          toast('Status posted!', 'success');
          closeModal(overlay);
          loadStatuses();
          renderListArea();
        } catch (e) { toast('Could not post status.', 'error'); }
      }}),
    ]),
  ]);
  const overlay = showModal(content);
}

/* ============================================================
   CALLS
   ============================================================ */
async function loadCalls() {
  if (!supabase || !state.user) return;
  try {
    const { data, error } = await supabase.from('calls').select('*').or(`caller_id.eq.${state.user.id},callee_id.eq.${state.user.id}`).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    state.calls = data || [];
  } catch (e) {
    console.warn('Load calls failed:', e);
    state.calls = [];
  }
}

function renderCallList(area) {
  if (state.calls.length === 0) {
    area.innerHTML = `<div class="list-empty">${I.phone}<p>No recent calls.</p></div>`;
    return;
  }
  area.innerHTML = state.calls.map(call => {
    const isOutgoing = call.caller_id === state.user?.id;
    const icon = call.call_type === 'video' ? I.video : I.phone;
    const statusIcon = call.status === 'missed' ? '<span style="color:var(--error);">Missed</span>' : call.status === 'completed' ? `<span style="color:var(--success);">${formatDuration(call.duration)}</span>` : call.status;
    return `<div class="chat-item"><div class="avatar avatar-md">${getInitials(isOutgoing ? 'Out' : 'In')}</div><div class="chat-item-body"><div class="chat-item-top"><span class="chat-item-name">${isOutgoing ? 'Outgoing' : 'Incoming'} ${call.call_type}</span><span class="chat-item-time">${formatDate(call.created_at)}</span></div><div class="chat-item-msg">${icon} ${statusIcon}</div></div></div>`;
  }).join('');
}

function startCall(type) {
  if (!state.activeChat) return;
  // WebRTC requires signaling server. Show info modal.
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: type === 'video' ? 'Video Call' : 'Voice Call' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('p', { text: 'Starting call...' }),
      el('p', { class: 'text-muted text-sm mt-2', text: 'Note: Real-time calling requires a WebRTC signaling server. This demo shows the call UI.' }),
    ]),
  ]);
  const overlay = showModal(content);
  // Log call
  if (supabase && state.activeChat && state.user) {
    const otherId = state.activeChat.other_profile?.id;
    if (otherId) {
      supabase.from('calls').insert({
        caller_id: state.user.id,
        callee_id: otherId,
        chat_id: state.activeChat.id,
        call_type: type,
        status: 'completed',
        duration: 0,
        direction: 'outgoing',
      }).then(() => loadCalls());
    }
  }
  setTimeout(() => {
    closeModal(overlay);
    showCallScreen(type);
  }, 1500);
}

function showCallScreen(type) {
  const chat = state.activeChat;
  if (!chat) return;
  const name = chat.type === 'private' ? (chat.other_profile?.display_name || chat.other_profile?.username || 'Unknown') : (chat.name || 'Group');
  const callEl = el('div', { class: 'call-screen', id: 'call-screen' }, [
    el('div', { class: 'call-avatar', text: getInitials(name) }),
    el('div', { class: 'call-name', text: name }),
    el('div', { class: 'call-status', text: 'Calling...' }),
    el('div', { class: 'call-controls' }, [
      el('button', { class: 'call-btn mute', id: 'call-mute', html: I.mic }),
      type === 'video' ? el('button', { class: 'call-btn camera', id: 'call-cam', html: I.video }) : null,
      el('button', { class: 'call-btn end', id: 'call-end', html: I.phoneOff }),
    ]),
  ]);
  document.body.append(callEl);
  $('#call-end').addEventListener('click', () => { callEl.remove(); toast('Call ended', 'success'); });
  $('#call-mute')?.addEventListener('click', e => { e.currentTarget.style.background = e.currentTarget.style.background === 'rgb(226, 232, 240)' ? '' : 'rgba(255,255,255,0.3)'; });
}

/* ============================================================
   CONTACTS
   ============================================================ */
async function loadContacts() {
  if (!supabase || !state.user) return;
  try {
    const { data, error } = await supabase.from('contacts').select('*, contact_id').eq('user_id', state.user.id);
    if (error) throw error;
    const contactIds = (data || []).map(c => c.contact_id);
    if (contactIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', contactIds);
      state.contacts = (data || []).map(c => ({ ...c, profile: profiles?.find(p => p.id === c.contact_id) }));
    } else {
      state.contacts = [];
    }
  } catch (e) {
    console.warn('Load contacts failed:', e);
    state.contacts = [];
  }
}

function renderContactsList(area) {
  let contacts = state.contacts;
  if (state.searchQuery) {
    contacts = contacts.filter(c => {
      const name = c.profile?.display_name || c.profile?.username || '';
      return name.toLowerCase().includes(state.searchQuery);
    });
  }
  let html = `<button class="fab" id="fab-contact">${I.plus}</button>`;
  if (contacts.length === 0) {
    html = `<div class="list-empty">${I.contacts}<p>No contacts yet. Tap + to add.</p></div>` + html;
  } else {
    html += contacts.map(c => {
      const name = c.profile?.display_name || c.profile?.username || 'Unknown';
      return `<div class="contact-item" data-contact-id="${c.contact_id}">${avatarHTML(c.profile, 'md')}<div class="contact-info"><div class="contact-name">${escapeHtml(name)}</div><div class="contact-sub">${c.profile?.online ? 'Online' : 'Last seen ' + formatDate(c.profile?.last_seen)}</div></div><button class="btn-icon" data-action="chat">${I.chat}</button></div>`;
    }).join('');
  }
  area.innerHTML = html;
  $('#fab-contact').addEventListener('click', showAddContactModal);
  $$('.contact-item', area).forEach(item => {
    item.addEventListener('click', () => startChatWithUser(item.dataset.contactId));
  });
}

function showAddContactModal() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Add Contact' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { class: 'input-group' }, [
        el('label', { class: 'input-label', text: 'Search by username' }),
        el('input', { class: 'input', id: 'contact-search', placeholder: 'Enter username...' }),
      ]),
      el('div', { id: 'contact-search-results', class: 'mt-4' }),
    ]),
  ]);
  const overlay = showModal(content);
  let searchTimer;
  $('#contact-search').addEventListener('input', async e => {
    clearTimeout(searchTimer);
    const query = e.target.value.trim();
    if (query.length < 2) { $('#contact-search-results').innerHTML = ''; return; }
    searchTimer = setTimeout(async () => {
      try {
        const { data: profiles } = await supabase.from('profiles').select('*').ilike('username', `%${query}%`).neq('id', state.user.id).limit(10);
        const results = $('#contact-search-results');
        if (!profiles || profiles.length === 0) { results.innerHTML = '<p class="text-muted text-center">No users found.</p>'; return; }
        results.innerHTML = profiles.map(p => `<div class="contact-item" data-user-id="${p.id}">${avatarHTML(p, 'sm')}<div class="contact-info"><div class="contact-name">${escapeHtml(p.display_name || p.username)}</div><div class="contact-sub">@${escapeHtml(p.username || '')}</div></div><button class="btn btn-sm btn-primary" data-action="add" data-user-id="${p.id}">Add</button></div>`).join('');
        $$('[data-action="add"]', results).forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              await supabase.from('contacts').insert({ user_id: state.user.id, contact_id: btn.dataset.userId });
              toast('Contact added!', 'success');
              loadContacts();
              closeModal(overlay);
            } catch (e) { toast('Could not add contact.', 'error'); }
          });
        });
      } catch (e) { $('#contact-search-results').innerHTML = '<p class="text-muted text-center">Search failed.</p>'; }
    }, 500);
  });
}

async function startChatWithUser(userId) {
  if (!supabase || !state.user) return;
  try {
    // Check if chat already exists
    const { data: existingMembers } = await supabase.from('chat_members').select('chat_id').eq('user_id', state.user.id);
    if (existingMembers && existingMembers.length > 0) {
      for (const m of existingMembers) {
        const { data: other } = await supabase.from('chat_members').select('chat_id').eq('chat_id', m.chat_id).eq('user_id', userId).maybeSingle();
        if (other) {
          const { data: chat } = await supabase.from('chats').select('*').eq('id', m.chat_id).maybeSingle();
          if (chat && chat.type === 'private') {
            openChat(chat.id);
            return;
          }
        }
      }
    }
    // Create new chat
    const { data: chat, error: chatErr } = await supabase.from('chats').insert({ type: 'private', created_by: state.user.id }).select().maybeSingle();
    if (chatErr) throw chatErr;
    await supabase.from('chat_members').insert([
      { chat_id: chat.id, user_id: state.user.id, role: 'member' },
      { chat_id: chat.id, user_id: userId, role: 'member' },
    ]);
    toast('Chat started!', 'success');
    await loadChats();
    openChat(chat.id);
  } catch (e) {
    toast('Could not start chat.', 'error');
    console.warn('Start chat failed:', e);
  }
}

/* ============================================================
   GROUPS
   ============================================================ */
function renderGroupsList(area) {
  const groups = state.chats.filter(c => c.type === 'group');
  let html = `<button class="fab" id="fab-group">${I.plus}</button>`;
  if (groups.length === 0) {
    html = `<div class="list-empty">${I.group}<p>No groups yet. Tap + to create one.</p></div>` + html;
  } else {
    html += groups.map(g => `<div class="chat-item" data-chat-id="${g.id}"><div class="avatar avatar-md">${getInitials(g.name)}</div><div class="chat-item-body"><div class="chat-item-name">${escapeHtml(g.name || 'Group')}</div><div class="chat-item-msg">${escapeHtml(g.description || 'Group chat')}</div></div></div>`).join('');
  }
  area.innerHTML = html;
  $('#fab-group').addEventListener('click', showCreateGroupModal);
  $$('.chat-item', area).forEach(item => item.addEventListener('click', () => openChat(item.dataset.chatId)));
}

function showCreateGroupModal() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Create Group' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Group Name' }),
        el('input', { class: 'input', id: 'group-name', placeholder: 'My Group' }),
      ]),
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Description' }),
        el('input', { class: 'input', id: 'group-desc', placeholder: 'Group description (optional)' }),
      ]),
      el('div', { class: 'input-group' }, [
        el('label', { class: 'input-label', text: 'Select Members' }),
        el('div', { id: 'group-members-list' }, state.contacts.map(c => {
          const name = c.profile?.display_name || c.profile?.username || 'Unknown';
          return `<div class="member-item" data-user-id="${c.contact_id}">${avatarHTML(c.profile, 'sm')}<div class="member-info"><div class="member-name">${escapeHtml(name)}</div></div><input type="checkbox" class="forward-check" data-user-id="${c.contact_id}" /></div>`;
        }).join('')),
      ]),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', text: 'Cancel', onclick: () => closeModal(overlay) }),
      el('button', { class: 'btn btn-primary', text: 'Create', onclick: async () => {
        const name = $('#group-name').value.trim();
        const desc = $('#group-desc').value.trim();
        if (!name) { toast('Enter a group name', 'error'); return; }
        const selected = $$('.forward-check:checked').map(cb => cb.dataset.userId);
        try {
          const { data: group, error } = await supabase.from('chats').insert({ type: 'group', name, description: desc, created_by: state.user.id }).select().maybeSingle();
          if (error) throw error;
          const members = [{ chat_id: group.id, user_id: state.user.id, role: 'owner' }];
          selected.forEach(uid => members.push({ chat_id: group.id, user_id: uid, role: 'member' }));
          await supabase.from('chat_members').insert(members);
          toast('Group created!', 'success');
          closeModal(overlay);
          await loadChats();
          openChat(group.id);
        } catch (e) { toast('Could not create group.', 'error'); }
      }}),
    ]),
  ]);
  const overlay = showModal(content);
}

/* ============================================================
   NUVO AI
   ============================================================ */
async function loadAiMessages() {
  if (!supabase || !state.user) return;
  try {
    const { data } = await supabase.from('ai_conversations').select('*').eq('user_id', state.user.id).order('created_at', { ascending: true }).limit(50);
    state.aiMessages = data || [];
  } catch (e) { state.aiMessages = []; }
}

function renderNuvoList(area) {
  area.innerHTML = `<div class="list-empty">${I.ai}<p>NUVO is your AI assistant. Tap to start chatting.</p></div>`;
  // Auto-open NUVO chat
  setTimeout(() => renderNuvoView(), 100);
}

function renderNuvoView() {
  const main = $('#main-area');
  main.innerHTML = `
    <div class="chat-view">
      <div class="main-header">
        <button class="btn-icon" id="nuvo-back">${I.back}</button>
        <div class="nuvo-avatar avatar-sm">N</div>
        <div class="main-header-info">
          <div class="main-header-title">NUVO</div>
          <div class="main-header-sub">AI Assistant</div>
        </div>
        <button class="btn-icon" id="nuvo-clear" title="Clear chat">${I.trash}</button>
      </div>
      <div class="chat-messages" id="nuvo-messages"></div>
      <div class="nuvo-suggestions" id="nuvo-suggestions">
        <button class="btn btn-sm btn-ghost" data-sugg="Summarize my last chat">Summarize</button>
        <button class="btn btn-sm btn-ghost" data-sugg="Help me write a reply">Write a reply</button>
        <button class="btn btn-sm btn-ghost" data-sugg="Translate to Spanish">Translate</button>
        <button class="btn btn-sm btn-ghost" data-sugg="Brainstorm ideas">Brainstorm</button>
      </div>
      <div class="composer">
        <div class="composer-input-wrap">
          <textarea class="composer-input" id="nuvo-input" placeholder="Ask NUVO anything..." rows="1"></textarea>
        </div>
        <button class="composer-send" id="nuvo-send">${I.send}</button>
      </div>
    </div>
  `;
  $('#nuvo-back').addEventListener('click', () => { switchView('chats'); });
  $('#nuvo-clear').addEventListener('click', async () => {
    if (!supabase) return;
    try {
      await supabase.from('ai_conversations').delete().eq('user_id', state.user.id);
      state.aiMessages = [];
      renderNuvoMessages();
      toast('Chat cleared', 'success');
    } catch (e) {}
  });
  $('#nuvo-send').addEventListener('click', handleNuvoSend);
  $('#nuvo-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNuvoSend(); } });
  $$('#nuvo-suggestions button').forEach(btn => {
    btn.addEventListener('click', () => { $('#nuvo-input').value = btn.dataset.sugg; handleNuvoSend(); });
  });
  loadAiMessages().then(renderNuvoMessages);
}

function renderNuvoMessages() {
  const container = $('#nuvo-messages');
  if (!container) return;
  if (state.aiMessages.length === 0) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;text-align:center;color:var(--text-muted);">
        <div class="nuvo-avatar avatar-xl" style="margin-bottom:16px;">N</div>
        <h2 style="margin-bottom:8px;">Hi, I'm NUVO</h2>
        <p style="max-width:320px;">Your AI assistant inside NUVORA. I can help you write messages, translate, summarize, brainstorm, and answer questions.</p>
      </div>
    `;
    return;
  }
  container.innerHTML = state.aiMessages.map(m => {
    if (m.role === 'user') {
      return `<div class="msg out"><div class="msg-bubble"><div class="msg-text">${escapeHtml(m.content)}</div><div class="msg-meta"><span>${formatTime(m.created_at)}</span></div></div></div>`;
    } else {
      return `<div class="msg in"><div class="nuvo-avatar avatar-sm" style="margin-right:8px;">N</div><div class="msg-bubble nuvo-bubble"><div class="msg-text">${escapeHtml(m.content)}</div><div class="msg-meta"><span>${formatTime(m.created_at)}</span></div></div></div>`;
    }
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function handleNuvoSend() {
  const input = $('#nuvo-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try {
    await supabase.from('ai_conversations').insert({ user_id: state.user.id, role: 'user', content: text });
    state.aiMessages.push({ role: 'user', content: text, created_at: new Date().toISOString() });
    renderNuvoMessages();
    // Typing indicator
    const container = $('#nuvo-messages');
    const typingEl = el('div', { class: 'msg in', id: 'nuvo-typing' });
    typingEl.innerHTML = `<div class="nuvo-avatar avatar-sm" style="margin-right:8px;">N</div><div class="msg-bubble nuvo-bubble"><div class="nuvo-typing"><span></span><span></span><span></span></div></div>`;
    container.append(typingEl);
    container.scrollTop = container.scrollHeight;
    // Call edge function
    let reply = '';
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/nuvo-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const data = await res.json();
        reply = data.reply || data.content || '';
      } else { reply = getFallbackResponse(text); }
    } catch (e) { reply = getFallbackResponse(text); }
    typingEl.remove();
    if (reply) {
      await supabase.from('ai_conversations').insert({ user_id: state.user.id, role: 'assistant', content: reply });
      state.aiMessages.push({ role: 'assistant', content: reply, created_at: new Date().toISOString() });
      renderNuvoMessages();
    }
  } catch (e) {
    toast('Could not send to NUVO.', 'error');
  }
}

function getFallbackResponse(text) {
  const lower = text.toLowerCase();
  if (lower.includes('translate')) return 'I can help with translations! For full AI translation, the NUVO service needs to be configured with an API key. Contact the app administrator.';
  if (lower.includes('summar')) return 'To summarize text, paste it here and I\'ll condense it. (Full AI summarization requires the NUVO service to be configured.)';
  if (lower.includes('write') || lower.includes('reply') || lower.includes('compose')) return 'I\'d love to help you write a message! Tell me what you want to say and to whom. (Full AI writing requires the NUVO service to be configured.)';
  return 'Hi! I\'m NUVO, your AI assistant. I can help with writing, translation, summarization, brainstorming, and answering questions. For full AI capabilities, the NUVO service needs to be configured with an API key.';
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
async function loadNotifications() {
  if (!supabase || !state.user) return;
  try {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    state.notifications = data || [];
  } catch (e) { state.notifications = []; }
}

function renderNotificationsList(area) {
  if (state.notifications.length === 0) {
    area.innerHTML = `<div class="list-empty">${I.bell}<p>No notifications.</p></div>`;
    return;
  }
  area.innerHTML = state.notifications.map(n => {
    const icon = n.type === 'message' ? I.chat : n.type === 'call' ? I.phone : n.type === 'status' ? I.status : n.type === 'group' ? I.group : I.info;
    return `<div class="notif-item ${!n.read ? 'unread' : ''}"><div class="notif-icon">${icon}</div><div class="notif-content"><div class="notif-title">${escapeHtml(n.title || '')}</div><div class="notif-body">${escapeHtml(n.body || '')}</div></div><div class="notif-time">${formatDate(n.created_at)}</div></div>`;
  }).join('');
  // Mark all as read
  if (supabase && state.user) {
    supabase.from('notifications').update({ read: true }).eq('user_id', state.user.id).eq('read', false).then(() => loadNotifications());
  }
}

/* ============================================================
   SETTINGS
   ============================================================ */
function renderSettingsList(area) {
  area.innerHTML = `
    <div class="settings-section">
      <div class="settings-group">
        <div class="settings-item" data-setting="profile">
          <div class="settings-item-icon">${I.user}</div>
          <div class="settings-item-label">Profile</div>
          <div class="settings-item-value">${escapeHtml(state.profile?.display_name || '')}</div>
          <svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="settings-item" data-setting="account">
          <div class="settings-item-icon">${I.shield}</div>
          <div class="settings-item-label">Account & Security</div>
          <svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="settings-item" data-setting="privacy">
          <div class="settings-item-icon">${I.block}</div>
          <div class="settings-item-label">Privacy</div>
          <svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="settings-item" data-setting="notifications">
          <div class="settings-item-icon">${I.bell}</div>
          <div class="settings-item-label">Notifications</div>
          <svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="settings-item" data-setting="appearance">
          <div class="settings-item-icon">${state.settings?.theme === 'dark' ? I.moon : I.sun}</div>
          <div class="settings-item-label">Appearance</div>
          <div class="settings-item-value">${escapeHtml(state.settings?.theme || 'system')}</div>
          <svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-item" data-setting="storage">
          <div class="settings-item-icon">${I.file}</div>
          <div class="settings-item-label">Storage & Data</div>
          <svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="settings-item" data-setting="blocked">
          <div class="settings-item-icon">${I.block}</div>
          <div class="settings-item-label">Blocked Users</div>
          <svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="settings-item" data-setting="help">
          <div class="settings-item-icon">${I.info}</div>
          <div class="settings-item-label">Help</div>
          <svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="settings-item" data-setting="about">
          <div class="settings-item-icon">${I.info}</div>
          <div class="settings-item-label">About NUVORA</div>
          <svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
    </div>
  `;
  $$('.settings-item', area).forEach(item => {
    item.addEventListener('click', () => openSetting(item.dataset.setting));
  });
}

function openSetting(setting) {
  switch (setting) {
    case 'profile': showProfileSettings(); break;
    case 'appearance': showAppearanceSettings(); break;
    case 'privacy': showPrivacySettings(); break;
    case 'notifications': showNotificationSettings(); break;
    case 'about': showAbout(); break;
    case 'blocked': showBlockedUsers(); break;
    case 'help': showHelp(); break;
    default: toast('Coming soon', 'success');
  }
}

function showProfileSettings() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Edit Profile' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { style: 'display:flex;justify-content:center;margin-bottom:20px;' }, [el('div', { html: avatarHTML(state.profile, 'xl') })]),
      el('div', { class: 'input-group mb-4' }, [el('label', { class: 'input-label', text: 'Display Name' }), el('input', { class: 'input', id: 'set-name', value: state.profile?.display_name || '' })]),
      el('div', { class: 'input-group mb-4' }, [el('label', { class: 'input-label', text: 'Username' }), el('input', { class: 'input', id: 'set-username', value: state.profile?.username || '' })]),
      el('div', { class: 'input-group mb-4' }, [el('label', { class: 'input-label', text: 'Bio' }), el('textarea', { class: 'textarea', id: 'set-bio', html: escapeHtml(state.profile?.bio || '') })]),
      el('div', { class: 'input-group' }, [
        el('label', { class: 'input-label', text: 'Avatar URL (optional)' }),
        el('input', { class: 'input', id: 'set-avatar', value: state.profile?.avatar_url || '', placeholder: 'https://...' }),
      ]),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', text: 'Cancel', onclick: () => closeModal(overlay) }),
      el('button', { class: 'btn btn-primary', text: 'Save', onclick: async () => {
        try {
          const updates = {
            display_name: $('#set-name').value.trim(),
            username: $('#set-username').value.trim(),
            bio: $('#set-bio').value.trim(),
            avatar_url: $('#set-avatar').value.trim() || null,
            updated_at: new Date().toISOString(),
          };
          await supabase.from('profiles').update(updates).eq('id', state.user.id);
          Object.assign(state.profile, updates);
          toast('Profile updated!', 'success');
          closeModal(overlay);
          renderListArea();
        } catch (e) { toast('Could not update profile.', 'error'); }
      }}),
    ]),
  ]);
  const overlay = showModal(content);
}

function showAppearanceSettings() {
  const themes = ['light', 'dark', 'system'];
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Appearance' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, themes.map(t => {
      const children = [
        el('div', { class: 'settings-item-icon', html: t === 'dark' ? I.moon : t === 'light' ? I.sun : I.settings }),
        el('div', { class: 'settings-item-label', text: t.charAt(0).toUpperCase() + t.slice(1) }),
      ];
      if (state.settings?.theme === t) children.push(el('div', { html: I.check, style: 'color:var(--brand);' }));
      return el('div', { class: 'settings-item', onclick: async () => {
        applyTheme(t);
        if (supabase && state.user) {
          try { await supabase.from('user_settings').update({ theme: t }).eq('user_id', state.user.id); } catch (e) {}
        }
        state.settings = state.settings || {};
        state.settings.theme = t;
        closeModal(overlay);
        renderListArea();
        toast('Theme changed to ' + t, 'success');
      }}, children);
    })),
  ]);
  const overlay = showModal(content);
}

function showPrivacySettings() {
  const s = state.settings || {};
  const toggles = [
    { key: 'read_receipts', label: 'Read Receipts' },
    { key: 'typing_indicators', label: 'Typing Indicators' },
    { key: 'last_seen_visible', label: 'Last Seen' },
  ];
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Privacy' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, toggles.map(t => el('div', { class: 'settings-item' }, [
      el('div', { class: 'settings-item-label', text: t.label }),
      el('label', { class: 'toggle' }, [
        el('input', { type: 'checkbox', checked: s[t.key] !== false, onchange: async (e) => {
          const val = e.target.checked;
          state.settings[t.key] = val;
          if (supabase) { try { await supabase.from('user_settings').update({ [t.key]: val }).eq('user_id', state.user.id); } catch (e2) {} }
        }}),
        el('span', { class: 'toggle-slider' }),
      ]),
    ]))),
  ]);
  const overlay = showModal(content);
}

function showNotificationSettings() {
  const s = state.settings || {};
  const toggles = [
    { key: 'notifications_enabled', label: 'Push Notifications' },
    { key: 'sound_enabled', label: 'Sound' },
    { key: 'email_notifications', label: 'Email Notifications' },
  ];
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Notifications' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, toggles.map(t => el('div', { class: 'settings-item' }, [
      el('div', { class: 'settings-item-label', text: t.label }),
      el('label', { class: 'toggle' }, [
        el('input', { type: 'checkbox', checked: s[t.key] !== false, onchange: async (e) => {
          const val = e.target.checked;
          state.settings[t.key] = val;
          if (supabase) { try { await supabase.from('user_settings').update({ [t.key]: val }).eq('user_id', state.user.id); } catch (e2) {} }
        }}),
        el('span', { class: 'toggle-slider' }),
      ]),
    ]))),
  ]);
  const overlay = showModal(content);
}

function showAbout() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'About NUVORA' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { style: 'text-align:center;padding:20px 0;' }, [
        el('div', { html: NUVORA_LOGO_SVG, style: 'display:flex;justify-content:center;margin-bottom:12px;' }),
        el('h2', { style: 'font-size:24px;font-weight:800;margin-bottom:4px;', text: 'NUVORA' }),
        el('p', { class: 'text-muted', text: 'Version 1.0.0' }),
        el('p', { style: 'margin-top:16px;font-size:14px;color:var(--text-secondary);', text: 'NUVORA is a global real-time messaging platform with the NUVO AI assistant. Built with vanilla HTML, CSS, and JavaScript.' }),
      ]),
    ]),
  ]);
  const overlay = showModal(content);
}

function showBlockedUsers() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Blocked Users' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, [el('p', { class: 'text-muted text-center', text: 'No blocked users.' })]),
  ]);
  const overlay = showModal(content);
}

function showHelp() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Help' }),
      el('button', { class: 'btn-icon', html: I.x, onclick: () => closeModal(overlay) }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('p', { style: 'margin-bottom:12px;font-weight:600;', text: 'Getting Started' }),
      el('p', { class: 'text-secondary text-sm', style: 'margin-bottom:12px;', text: '1. Add your Supabase URL and key at the top of script.js' }),
      el('p', { class: 'text-secondary text-sm', style: 'margin-bottom:12px;', text: '2. Create an account from the sign-up screen' }),
      el('p', { class: 'text-secondary text-sm', style: 'margin-bottom:12px;', text: '3. Search for users in Contacts to start chatting' }),
      el('p', { class: 'text-secondary text-sm', style: 'margin-bottom:12px;', text: '4. Create groups from the Groups tab' }),
      el('p', { class: 'text-secondary text-sm', style: 'margin-bottom:12px;', text: '5. Ask NUVO for help with writing, translation, and more' }),
    ]),
  ]);
  const overlay = showModal(content);
}

/* ============================================================
   MAIN AREA RENDER
   ============================================================ */
function renderMainArea() {
  const main = $('#main-area');
  if (!main) return;
  if (state.activeView === 'nuvo' && !state.activeChat) {
    renderNuvoView();
    return;
  }
  if (state.activeChat) {
    renderChatView();
  } else {
    main.innerHTML = `
      <div class="empty-state">
        ${NUVORA_LOGO_SVG}
        <h2>Welcome to NUVORA</h2>
        <p>Select a chat or start a new conversation to begin messaging.</p>
      </div>
    `;
  }
}

/* ============================================================
   REALTIME
   ============================================================ */
function subscribeRealtime() {
  if (!supabase || !state.user) return;
  try {
    // Messages
    const msgSub = supabase.channel('messages-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=in.(${state.chats.map(c => c.id).join(',')})` }, payload => {
        if (state.activeChat && payload.new.chat_id === state.activeChat.id) {
          state.messages.push(payload.new);
          renderMessages();
        }
        // Update chat list
        const chat = state.chats.find(c => c.id === payload.new.chat_id);
        if (chat) { chat.last_message = payload.new; renderListArea(); }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
        const idx = state.messages.findIndex(m => m.id === payload.new.id);
        if (idx >= 0) { state.messages[idx] = payload.new; renderMessages(); }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        state.messages = state.messages.filter(m => m.id !== payload.old.id);
        renderMessages();
      })
      .subscribe();
    state.subscriptions.push(msgSub);

    // Chats
    const chatSub = supabase.channel('chats-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => loadChats())
      .subscribe();
    state.subscriptions.push(chatSub);

    // Chat members (to detect new chats)
    const memberSub = supabase.channel('members-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_members', filter: `user_id=eq.${state.user.id}` }, () => loadChats())
      .subscribe();
    state.subscriptions.push(memberSub);

    // Notifications
    const notifSub = supabase.channel('notifications-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${state.user.id}` }, payload => {
        state.notifications.unshift(payload.new);
        if (state.activeView === 'notifications') renderListArea();
        toast(payload.new.title || 'New notification', 'success');
      })
      .subscribe();
    state.subscriptions.push(notifSub);

    // Typing indicators
    if (state.activeChat) {
      const typingSub = supabase.channel('typing-' + state.activeChat.id)
        .on('broadcast', { event: 'typing' }, payload => {
          // Show/hide typing indicator
          const header = $('.main-header-sub');
          if (header && state.activeChat) {
            if (payload.payload.typing && payload.payload.user_id !== state.user.id) {
              header.textContent = 'typing...';
            } else {
              header.textContent = state.activeChat.other_profile?.online ? 'Online' : 'Offline';
            }
          }
        })
        .subscribe();
      state.subscriptions.push(typingSub);
    }
  } catch (e) {
    console.warn('Realtime subscription failed:', e);
  }
}

function cleanupSubscriptions() {
  state.subscriptions.forEach(sub => { try { sub.unsubscribe(); } catch (e) {} });
  state.subscriptions = [];
}

/* ============================================================
   PRESENCE (online status)
   ============================================================ */
async function updatePresence() {
  if (!supabase || !state.user) return;
  try {
    await supabase.from('profiles').update({ online: true, last_seen: new Date().toISOString() }).eq('id', state.user.id);
  } catch (e) {}
}

window.addEventListener('beforeunload', async () => {
  if (supabase && state.user) {
    try {
      await supabase.from('profiles').update({ online: false, last_seen: new Date().toISOString() }).eq('id', state.user.id);
    } catch (e) {}
  }
});

setInterval(updatePresence, 30000);

/* ============================================================
   INITIALIZATION
   ============================================================ */
async function initializeNuvora() {
  // Hide loading screen
  $('#loading-screen').style.display = 'none';

  if (!state.supabaseReady) {
    // Show auth screen with setup banner
    renderAuth();
    return;
  }

  await initAuth();

  if (state.user) {
    renderApp();
  } else {
    renderAuth();
  }
}

// Global error handler
window.addEventListener('error', (e) => {
  console.error('NUVORA error:', e.error);
  $('#loading-screen').style.display = 'none';
  $('#error-screen').classList.remove('hidden');
});

window.addEventListener('unhandledrejection', (e) => {
  console.warn('Unhandled rejection:', e.reason);
});

// Start the app
try {
  document.addEventListener('DOMContentLoaded', initializeNuvora);
  // If DOM is already loaded
  if (document.readyState !== 'loading') initializeNuvora();
} catch (error) {
  $('#loading-screen').style.display = 'none';
  $('#error-screen').classList.remove('hidden');
  console.error('NUVORA startup error:', error);
}
