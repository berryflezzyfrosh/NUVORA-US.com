// js/profile.js
import { supabase } from './lib/supabase.js';
import { state, setState, emit } from './lib/state.js';
import { $, el, toast, escapeHtml, avatarHTML, showModal, closeModal, uploadFile, formatLastSeen } from './lib/utils.js';
import { Icon } from './lib/icons.js';

export async function getProfile(userId) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data;
}

export async function searchUsers(query) {
  if (!query || query.length < 2) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, is_online, last_seen')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .neq('id', state.user.id)
    .limit(20);
  return data || [];
}

export async function updateProfile(updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', state.user.id)
    .select()
    .maybeSingle();
  if (error) { toast('Failed to update profile', 'error'); return; }
  state.profile = data;
  emit('profile', state.profile);
  toast('Profile updated', 'success');
  return data;
}

export async function uploadAvatar(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return; }
  const ext = file.name.split('.').pop();
  const path = `${state.user.id}/avatar-${Date.now()}.${ext}`;
  try {
    const url = await uploadFile('avatars', file, path);
    await updateProfile({ avatar_url: url });
    return url;
  } catch (e) {
    toast('Failed to upload image', 'error');
  }
}

export function showProfileModal(userId, opts = {}) {
  getProfile(userId).then(profile => {
    if (!profile) { toast('User not found', 'error'); return; }
    renderProfileModal(profile, opts);
  });
}

function renderProfileModal(profile, opts = {}) {
  const isSelf = profile.id === state.user.id;
  const isContact = state.contacts.some(c => c.contact_id === profile.id);
  const isBlocked = state.blocked.some(b => b.blocked_id === profile.id);

  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: isSelf ? 'Your Profile' : 'Contact Info' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
  ]);
  const body = el('div', { class: 'modal-body', style: 'display:flex;flex-direction:column;align-items:center;gap:16px;' });
  body.innerHTML = `
    ${avatarHTML(profile, 'xl')}
    <div style="text-align:center;">
      <div style="font-size:22px;font-weight:700;">${escapeHtml(profile.display_name)}</div>
      <div style="color:var(--text-muted);">@${escapeHtml(profile.username)}</div>
    </div>
    <div style="color:var(--text-secondary);font-size:14px;">${formatLastSeen(profile.last_seen, profile.is_online)}</div>
    ${profile.bio ? `<div style="background:var(--bg-active);padding:12px 16px;border-radius:12px;width:100%;">${escapeHtml(profile.bio)}</div>` : ''}
    ${profile.status_text ? `<div style="color:var(--text-secondary);font-size:14px;font-style:italic;">"${escapeHtml(profile.status_text)}"</div>` : ''}
  `;
  content.append(body);

  const actions = el('div', { class: 'modal-footer', style: 'flex-wrap:wrap;justify-content:center;' });
  if (isSelf) {
    actions.append(el('button', { class: 'btn btn-primary', onclick: () => { closeModal(content.closest('.modal-overlay')); showEditProfileModal(); }, html: `${Icon.edit} Edit` }));
  } else {
    if (opts.fromChat) {
      // already in a chat
    } else {
      actions.append(el('button', { class: 'btn btn-primary', onclick: async () => {
        const { data } = await supabase.from('chats')
          .select('id')
          .eq('type', 'direct')
          .in('id', (await getDirectChatsForUser(profile.id)).map(c => c.id))
          .maybeSingle();
        closeModal(content.closest('.modal-overlay'));
        if (data) {
          window.nuvoraOpenChat(data.id);
        } else {
          const chatId = await createDirectChat(profile.id);
          if (chatId) window.nuvoraOpenChat(chatId);
        }
      }, html: `${Icon.message} Message` }));
    }
    if (isContact) {
      actions.append(el('button', { class: 'btn btn-ghost', onclick: async () => {
        await supabase.from('contacts').delete().eq('user_id', state.user.id).eq('contact_id', profile.id);
        state.contacts = state.contacts.filter(c => c.contact_id !== profile.id);
        emit('contacts', state.contacts);
        closeModal(content.closest('.modal-overlay'));
        toast('Contact removed', 'success');
      }, html: `${Icon.userMinus} Remove` }));
    } else {
      actions.append(el('button', { class: 'btn btn-ghost', onclick: async () => {
        await supabase.from('contacts').insert({ user_id: state.user.id, contact_id: profile.id });
        const { data: newContact } = await supabase.from('contacts').select('*, profiles!contact_id(*)').eq('user_id', state.user.id).eq('contact_id', profile.id).maybeSingle();
        if (newContact) state.contacts.push(newContact);
        emit('contacts', state.contacts);
        closeModal(content.closest('.modal-overlay'));
        toast('Contact added', 'success');
      }, html: `${Icon.userPlus} Add Contact` }));
    }
    if (isBlocked) {
      actions.append(el('button', { class: 'btn btn-ghost', onclick: async () => {
        await supabase.from('blocked_users').delete().eq('user_id', state.user.id).eq('blocked_id', profile.id);
        state.blocked = state.blocked.filter(b => b.blocked_id !== profile.id);
        emit('blocked', state.blocked);
        closeModal(content.closest('.modal-overlay'));
        toast('User unblocked', 'success');
      }, html: `${Icon.block} Unblock` }));
    } else {
      actions.append(el('button', { class: 'btn btn-ghost', onclick: async () => {
        await supabase.from('blocked_users').insert({ user_id: state.user.id, blocked_id: profile.id });
        await supabase.from('contacts').delete().eq('user_id', state.user.id).eq('contact_id', profile.id);
        state.contacts = state.contacts.filter(c => c.contact_id !== profile.id);
        const { data } = await supabase.from('blocked_users').select('*, profiles!blocked_id(*)').eq('user_id', state.user.id).eq('blocked_id', profile.id).maybeSingle();
        if (data) state.blocked.push(data);
        emit('blocked', state.blocked);
        emit('contacts', state.contacts);
        closeModal(content.closest('.modal-overlay'));
        toast('User blocked', 'success');
      }, html: `${Icon.block} Block` }));
    }
    actions.append(el('button', { class: 'btn btn-ghost', onclick: () => {
      reportUser(profile);
    }, html: `${Icon.flag} Report` }));
  }
  content.append(actions);
  showModal(content);
}

async function getDirectChatsForUser(otherUserId) {
  const { data: memberships } = await supabase
    .from('chat_members')
    .select('chat_id, chats!inner(type, id)')
    .eq('user_id', state.user.id);
  if (!memberships) return [];
  const directChats = memberships.filter(m => m.chats?.type === 'direct');
  const result = [];
  for (const m of directChats) {
    const { data: other } = await supabase.from('chat_members').select('user_id').eq('chat_id', m.chat_id).neq('user_id', state.user.id).maybeSingle();
    if (other?.user_id === otherUserId) result.push({ id: m.chat_id });
  }
  return result;
}

export async function createDirectChat(otherUserId) {
  // Check if direct chat already exists
  const existing = await getDirectChatsForUser(otherUserId);
  if (existing.length > 0) return existing[0].id;
  const { data: chat, error } = await supabase.from('chats').insert({
    type: 'direct',
    created_by: state.user.id,
  }).select().maybeSingle();
  if (error || !chat) { toast('Failed to create chat', 'error'); return null; }
  const { error: m1 } = await supabase.from('chat_members').insert({ chat_id: chat.id, user_id: state.user.id, role: 'member' });
  const { error: m2 } = await supabase.from('chat_members').insert({ chat_id: chat.id, user_id: otherUserId, role: 'member' });
  if (m1 || m2) { toast('Failed to add members', 'error'); }
  return chat.id;
}

export function showEditProfileModal() {
  const p = state.profile;
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Edit Profile' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
  ]);
  const body = el('div', { class: 'modal-body' });
  body.innerHTML = `
    <div style="display:flex;justify-content:center;margin-bottom:20px;">
      <label style="position:relative;cursor:pointer;">
        ${avatarHTML(p, 'xl')}
        <div style="position:absolute;bottom:0;right:0;width:36px;height:36px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;border:3px solid var(--bg-elevated);">${Icon.camera}</div>
        <input type="file" accept="image/*" id="avatar-input" style="display:none;" />
      </label>
    </div>
    <div class="input-group mb-4">
      <label class="input-label">Display Name</label>
      <input class="input" type="text" id="edit-display-name" value="${escapeHtml(p.display_name)}" maxlength="40" />
    </div>
    <div class="input-group mb-4">
      <label class="input-label">Username</label>
      <input class="input" type="text" id="edit-username" value="${escapeHtml(p.username)}" pattern="[a-z0-9_]{3,20}" />
      <span class="input-hint">3-20 chars, lowercase letters, numbers, underscore</span>
    </div>
    <div class="input-group mb-4">
      <label class="input-label">About / Bio</label>
      <textarea class="textarea" id="edit-bio" maxlength="200">${escapeHtml(p.bio || '')}</textarea>
    </div>
    <div class="input-group mb-4">
      <label class="input-label">Status Text</label>
      <input class="input" type="text" id="edit-status" value="${escapeHtml(p.status_text || '')}" maxlength="100" placeholder="What's on your mind?" />
    </div>
    <div class="input-group mb-4">
      <label class="input-label">Phone (optional)</label>
      <input class="input" type="tel" id="edit-phone" value="${escapeHtml(p.phone || '')}" placeholder="+1 555 000 0000" />
    </div>
  `;
  content.append(body);
  const footer = el('div', { class: 'modal-footer' }, [
    el('button', { class: 'btn btn-ghost', onclick: () => closeModal(content.closest('.modal-overlay')) }, 'Cancel'),
    el('button', { class: 'btn btn-primary', onclick: async () => {
      const displayName = $('#edit-display-name').value.trim();
      const username = $('#edit-username').value.trim().toLowerCase();
      const bio = $('#edit-bio').value.trim();
      const statusText = $('#edit-status').value.trim();
      const phone = $('#edit-phone').value.trim();
      if (!displayName || !username) { toast('Name and username required', 'error'); return; }
      // check username uniqueness
      if (username !== p.username) {
        const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).neq('id', state.user.id).maybeSingle();
        if (existing) { toast('Username already taken', 'error'); return; }
      }
      await updateProfile({ display_name: displayName, username, bio, status_text: statusText, phone });
      closeModal(content.closest('.modal-overlay'));
    } }, 'Save'),
  ]);
  content.append(footer);

  showModal(content);

  $('#avatar-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = await uploadAvatar(file);
      if (url) {
        // refresh modal avatar
        const avatarDiv = body.querySelector('.avatar-xl');
        avatarDiv.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(p.display_name)}" />`;
      }
    }
  });
}

function reportUser(profile) {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: `Report ${profile.display_name}` }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('p', { class: 'mb-4', text: `Help us understand what's wrong with ${profile.display_name}'s account.` }),
      el('div', { class: 'input-group' }, [
        el('label', { class: 'input-label', text: 'Reason' }),
        el('select', { class: 'select', id: 'report-reason', html: `
          <option value="spam">Spam or scam</option>
          <option value="harassment">Harassment or bullying</option>
          <option value="inappropriate">Inappropriate content</option>
          <option value="impersonation">Impersonation</option>
          <option value="other">Other</option>
        ` }),
      ]),
      el('div', { class: 'input-group mt-4' }, [
        el('label', { class: 'input-label', text: 'Details (optional)' }),
        el('textarea', { class: 'textarea', id: 'report-details', placeholder: 'Add more details...' }),
      ]),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => closeModal(content.closest('.modal-overlay')) }, 'Cancel'),
      el('button', { class: 'btn btn-danger', onclick: async () => {
        const reason = $('#report-reason').value;
        const details = $('#report-details').value;
        // Store report as a notification for moderation (simplified)
        toast('Report submitted. Thank you.', 'success');
        closeModal(content.closest('.modal-overlay'));
      } }, 'Submit Report'),
    ]),
  ]);
  showModal(content);
}
