// js/groups.js
import { supabase } from './lib/supabase.js';
import { state, emit } from './lib/state.js';
import { $, el, toast, escapeHtml, avatarHTML, showModal, closeModal, confirmDialog, uploadFile, debounce } from './lib/utils.js';
import { Icon } from './lib/icons.js';
import { searchUsers, getProfile } from './profile.js';
import { loadChats, openChat } from './chat.js';

export async function createGroup(name, description, memberIds) {
  const { data: chat, error } = await supabase.from('chats').insert({
    type: 'group',
    name,
    description: description || '',
    created_by: state.user.id,
  }).select().maybeSingle();
  if (error || !chat) { toast('Failed to create group', 'error'); return null; }

  // Add creator as owner
  await supabase.from('chat_members').insert({ chat_id: chat.id, user_id: state.user.id, role: 'owner' });
  // Add members
  for (const userId of memberIds) {
    await supabase.from('chat_members').insert({ chat_id: chat.id, user_id: userId, role: 'member' });
  }

  toast('Group created', 'success');
  loadChats();
  return chat.id;
}

export async function showGroupInfo(chatId) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;

  const { data: members } = await supabase
    .from('chat_members')
    .select('*, profiles!chat_members_user_id_fkey(id, username, display_name, avatar_url, is_online, last_seen)')
    .eq('chat_id', chatId)
    .order('role', { ascending: false });

  const myRole = members?.find(m => m.user_id === state.user.id)?.role;
  const isAdmin = myRole === 'admin' || myRole === 'owner';
  const isOwner = myRole === 'owner';

  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Group Info' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
  ]);

  const body = el('div', { class: 'modal-body' });
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:20px;">
      <label style="position:relative;cursor:${isAdmin ? 'pointer' : 'default'};">
        ${avatarHTML({ display_name: chat.name, avatar_url: chat.avatar_url }, 'xl')}
        ${isAdmin ? `<div style="position:absolute;bottom:0;right:0;width:36px;height:36px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;border:3px solid var(--bg-elevated);">${Icon.camera}</div><input type="file" accept="image/*" id="group-avatar-input" style="display:none;" />` : ''}
      </label>
      <div style="text-align:center;">
        <div style="font-size:22px;font-weight:700;">${escapeHtml(chat.name)}</div>
        ${chat.description ? `<div style="color:var(--text-muted);font-size:14px;margin-top:4px;">${escapeHtml(chat.description)}</div>` : ''}
        <div style="color:var(--text-muted);font-size:13px;margin-top:4px;">${members?.length || 0} members</div>
      </div>
    </div>
    <div class="detail-section-title">Members</div>
    <div id="group-members-list"></div>
  `;
  content.append(body);

  const footer = el('div', { class: 'modal-footer', style: 'flex-wrap:wrap;' });
  if (isAdmin) {
    footer.append(el('button', { class: 'btn btn-primary', onclick: () => { closeModal(content.closest('.modal-overlay')); addGroupMembers(chatId); }, html: `${Icon.userPlus} Add Members` }));
    footer.append(el('button', { class: 'btn btn-ghost', onclick: () => editGroupInfo(chatId, chat), html: `${Icon.edit} Edit Info` }));
  }
  if (isOwner) {
    footer.append(el('button', { class: 'btn btn-ghost', onclick: async () => {
      const ok = await confirmDialog('Delete group?', 'This will permanently delete the group and all messages.', 'Delete', 'Cancel', true);
      if (ok) {
        await supabase.from('chats').delete().eq('id', chatId);
        closeModal(content.closest('.modal-overlay'));
        loadChats();
        toast('Group deleted', 'success');
      }
    }, html: `${Icon.trash2} Delete Group` }));
  }
  footer.append(el('button', { class: 'btn btn-ghost', onclick: async () => {
    const ok = await confirmDialog('Leave group?', 'You will no longer receive messages from this group.', 'Leave', 'Cancel', true);
    if (ok) {
      await supabase.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', state.user.id);
      closeModal(content.closest('.modal-overlay'));
      loadChats();
      toast('Left group', 'success');
    }
  }, html: `${Icon.logout} Leave` }));
  content.append(footer);

  showModal(content, { large: true });

  // Render members
  const membersList = body.querySelector('#group-members-list');
  if (members) {
    membersList.innerHTML = members.map(m => `
      <div class="member-item" data-user-id="${m.user_id}">
        ${avatarHTML(m.profiles, 'sm')}
        <div class="member-info">
          <div class="member-name">${escapeHtml(m.profiles?.display_name || 'Unknown')}</div>
          ${m.role !== 'member' ? `<div class="member-role">${m.role}</div>` : ''}
        </div>
        ${isAdmin && m.user_id !== state.user.id ? `
          <div class="member-actions">
            ${isOwner && m.role !== 'owner' ? `<button class="btn-icon" data-action="promote" data-user-id="${m.user_id}" title="Make admin">${Icon.crown}</button>` : ''}
            ${isOwner && m.role === 'admin' ? `<button class="btn-icon" data-action="demote" data-user-id="${m.user_id}" title="Remove admin">${Icon.user}</button>` : ''}
            <button class="btn-icon" data-action="remove" data-user-id="${m.user_id}" title="Remove">${Icon.userMinus}</button>
          </div>
        ` : ''}
      </div>
    `).join('');

    membersList.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const userId = btn.dataset.userId;
        handleMemberAction(chatId, userId, action, content);
      });
    });
  }

  // Avatar upload
  $('#group-avatar-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return; }
    const path = `groups/${chatId}/avatar-${Date.now()}.${file.name.split('.').pop()}`;
    try {
      const url = await uploadFile('avatars', file, path);
      await supabase.from('chats').update({ avatar_url: url }).eq('id', chatId);
      toast('Group photo updated', 'success');
      closeModal(content.closest('.modal-overlay'));
      await loadChats();
      showGroupInfo(chatId);
    } catch (err) {
      toast('Failed to upload', 'error');
    }
  });
}

async function handleMemberAction(chatId, userId, action, modalContent) {
  if (action === 'promote') {
    await supabase.from('chat_members').update({ role: 'admin' }).eq('chat_id', chatId).eq('user_id', userId);
    toast('Promoted to admin', 'success');
  } else if (action === 'demote') {
    await supabase.from('chat_members').update({ role: 'member' }).eq('chat_id', chatId).eq('user_id', userId);
    toast('Removed admin', 'success');
  } else if (action === 'remove') {
    const ok = await confirmDialog('Remove member?', 'This user will be removed from the group.', 'Remove', 'Cancel', true);
    if (!ok) return;
    await supabase.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', userId);
    toast('Member removed', 'success');
  }
  closeModal(modalContent.closest('.modal-overlay'));
  await loadChats();
  showGroupInfo(chatId);
}

function editGroupInfo(chatId, chat) {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Edit Group' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Group Name' }),
        el('input', { class: 'input', id: 'edit-group-name', value: escapeHtml(chat.name) }),
      ]),
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Description' }),
        el('textarea', { class: 'textarea', id: 'edit-group-desc', html: escapeHtml(chat.description || '') }),
      ]),
      el('div', { class: 'input-group' }, [
        el('label', { style: 'display:flex;align-items:center;gap:10px;cursor:pointer;' }, [
          el('input', { type: 'checkbox', id: 'admins-only', checked: chat.only_admins_can_message, style: 'width:auto;' }),
          el('span', { class: 'input-label', text: 'Only admins can send messages' }),
        ]),
      ]),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => closeModal(content.closest('.modal-overlay')) }, 'Cancel'),
      el('button', { class: 'btn btn-primary', onclick: async () => {
        const name = $('#edit-group-name').value.trim();
        const desc = $('#edit-group-desc').value.trim();
        const adminsOnly = $('#admins-only').checked;
        await supabase.from('chats').update({
          name, description: desc, only_admins_can_message: adminsOnly,
        }).eq('id', chatId);
        toast('Group updated', 'success');
        closeModal(content.closest('.modal-overlay'));
        loadChats();
      } }, 'Save'),
    ]),
  ]);
  showModal(content);
}

export async function addGroupMembers(chatId) {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Add Members' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { class: 'search-wrap mb-4' }, [
        Icon.search,
        el('input', { class: 'input', id: 'add-member-search', placeholder: 'Search users...', style: 'padding-left:38px;' }),
      ]),
      el('div', { id: 'add-member-results' }, ''),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => closeModal(content.closest('.modal-overlay')) }, 'Close'),
    ]),
  ]);
  showModal(content);

  $('#add-member-search').addEventListener('input', debounce(async (e) => {
    const results = await searchUsers(e.target.value);
    const list = $('#add-member-results');
    list.innerHTML = results.map(u => `
      <div class="member-item" data-user-id="${u.id}">
        ${avatarHTML(u, 'sm')}
        <div class="member-info">
          <div class="member-name">${escapeHtml(u.display_name)}</div>
          <div style="font-size:12px;color:var(--text-muted);">@${escapeHtml(u.username)}</div>
        </div>
        <button class="btn btn-sm btn-primary">Add</button>
      </div>
    `).join('');
    list.querySelectorAll('.member-item').forEach(item => {
      item.addEventListener('click', async () => {
        const userId = item.dataset.userId;
        const { error } = await supabase.from('chat_members').insert({ chat_id: chatId, user_id: userId, role: 'member' });
        if (error) {
          if (error.code === '23505') toast('Already a member', 'error');
          else toast('Failed to add member', 'error');
        } else {
          toast('Member added', 'success');
          item.remove();
        }
      });
    });
  }, 300));
}
