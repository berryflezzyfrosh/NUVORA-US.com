// js/messageActions.js
import { supabase } from './lib/supabase.js';
import { state, emit } from './lib/state.js';
import { $, el, toast, escapeHtml, showModal, closeModal, confirmDialog } from './lib/utils.js';
import { Icon } from './lib/icons.js';
import { editMessage, deleteMessage, starMessage, toggleReaction, forwardMessage, getMessages } from './chat.js';
import { setReplyTo } from './lib/replyState.js';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function renderMessageContextMenu(e, msg) {
  // Close existing
  $('.context-menu')?.remove();
  $('.reaction-picker')?.remove();

  const isOutgoing = msg.sender_id === state.user.id;
  const isDeleted = msg.deleted_for_everyone;
  const isStarred = (msg.starred_by || []).includes(state.user.id);

  // First show reaction picker above context menu
  const reactionPicker = el('div', { class: 'reaction-picker', style: `position:fixed;top:${Math.max(e.clientY - 50, 10)}px;left:${e.clientX}px;z-index:600;` });
  QUICK_REACTIONS.forEach(emoji => {
    const cell = el('div', { class: 'emoji-cell', text: emoji });
    cell.addEventListener('click', () => {
      toggleReaction(msg.id, emoji);
      reactionPicker.remove();
      menu.remove();
    });
    reactionPicker.append(cell);
  });
  document.body.append(reactionPicker);

  const menu = el('div', { class: 'context-menu', style: `top:${e.clientY}px;left:${e.clientX}px;` });
  const items = [];

  items.push({ label: 'Reply', icon: Icon.reply, action: () => setReplyTo(msg) });

  if (!isDeleted) {
    items.push({ label: 'React', icon: Icon.smile, action: () => {
      // Already showing reaction picker, just keep it
    }});
    items.push({ label: 'Copy', icon: Icon.copy, action: () => {
      navigator.clipboard.writeText(msg.body || msg.attachment_name || '');
      toast('Copied', 'success');
    }});
    items.push({ label: 'Forward', icon: Icon.forward, action: () => showForwardModal(msg) });
    items.push({ label: isStarred ? 'Unstar' : 'Star', icon: isStarred ? Icon.starFilled : Icon.star, action: () => starMessage(msg.id) });
  }

  if (isOutgoing && !isDeleted) {
    items.push({ divider: true });
    items.push({ label: 'Edit', icon: Icon.edit, action: () => showEditMessageModal(msg) });
  }

  items.push({ divider: true });
  items.push({ label: 'Delete for me', icon: Icon.trash, action: () => deleteMessage(msg.id, false), danger: true });
  if (isOutgoing && !isDeleted) {
    items.push({ label: 'Delete for everyone', icon: Icon.trash2, action: () => deleteMessage(msg.id, true), danger: true });
  }

  let html = '';
  items.forEach((it, i) => {
    if (it.divider) html += '<div class="context-menu-divider"></div>';
    else html += `<div class="context-menu-item ${it.danger ? 'danger' : ''}" data-idx="${i}">${it.icon}<span>${it.label}</span></div>`;
  });
  menu.innerHTML = html;
  document.body.append(menu);

  // Adjust position if off-screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 10) + 'px';

  menu.querySelectorAll('.context-menu-item').forEach(mi => {
    mi.addEventListener('click', () => {
      const idx = parseInt(mi.dataset.idx);
      menu.remove();
      reactionPicker.remove();
      items[idx].action();
    });
  });

  setTimeout(() => {
    document.addEventListener('click', function close() {
      menu.remove();
      reactionPicker.remove();
      document.removeEventListener('click', close);
    });
  }, 100);

  // Prevent the document click from immediately closing
  e.preventDefault?.();
  e.stopPropagation?.();
}

function showEditMessageModal(msg) {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Edit Message' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('textarea', { class: 'textarea', id: 'edit-msg-input', html: escapeHtml(msg.body) }),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => closeModal(content.closest('.modal-overlay')) }, 'Cancel'),
      el('button', { class: 'btn btn-primary', onclick: async () => {
        const newText = $('#edit-msg-input').value.trim();
        if (newText && newText !== msg.body) {
          await editMessage(msg.id, newText);
          closeModal(content.closest('.modal-overlay'));
        }
      } }, 'Save'),
    ]),
  ]);
  showModal(content);
}

function showForwardModal(msg) {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Forward To' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      (() => {
        const listHtml = state.chats.filter(c => c.type !== 'broadcast').map(c => {
          const initial = c.name && c.name[0] ? c.name[0].toUpperCase() : '?';
          return '<div class="member-item" data-chat-id="' + c.id + '">' +
            '<div class="avatar avatar-sm">' + escapeHtml(initial) + '</div>' +
            '<div class="member-info"><div class="member-name">' + escapeHtml(c.name) + '</div></div>' +
            '<input type="checkbox" class="forward-check" data-chat-id="' + c.id + '" /></div>';
        }).join('');
        const div = el('div', { id: 'forward-list' });
        div.innerHTML = listHtml;
        return div;
      })(),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => closeModal(content.closest('.modal-overlay')) }, 'Cancel'),
      el('button', { class: 'btn btn-primary', onclick: () => {
        const selected = $$('.forward-check:checked').map(cb => cb.dataset.chatId);
        if (selected.length === 0) { toast('Select at least one chat', 'error'); return; }
        forwardMessage(msg.id, selected);
        closeModal(content.closest('.modal-overlay'));
      } }, 'Forward'),
    ]),
  ]);
  showModal(content);
  $$('.forward-check').forEach(cb => {
    cb.addEventListener('click', (e) => e.stopPropagation());
  });
  $$('#forward-list .member-item').forEach(item => {
    item.addEventListener('click', () => {
      const cb = item.querySelector('.forward-check');
      cb.checked = !cb.checked;
    });
  });
}
