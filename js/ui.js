// js/ui.js
import { supabase } from './lib/supabase.js';
import { state, setState, emit, subscribe, applyTheme } from './lib/state.js';
import { $, el, toast, escapeHtml, avatarHTML, formatTime, formatDate, formatDateTime, formatFileSize, formatDuration, showModal, closeModal, confirmDialog, debounce, uuid, toggleArray, getMediaType, linkify, requestNotificationPermission, showBrowserNotification } from './lib/utils.js';
import { Icon } from './lib/icons.js';
import { logout, updatePresence } from './auth.js';
import { loadChats, openChat, markChatRead, sendMessage, editMessage, deleteMessage, starMessage, toggleReaction, forwardMessage, pinChat, muteChat, archiveChat, clearChatHistory, deleteChat, sendTyping, searchMessages, getMessages } from './chat.js';
import { getProfile, searchUsers, showProfileModal, showEditProfileModal, createDirectChat } from './profile.js';
import { createGroup, showGroupInfo, addGroupMembers } from './groups.js';
import { renderStatusView, postStatus, loadStatuses } from './status.js';
import { renderCallsView, callHistory } from './calls.js';
import { renderNuvoView } from './ai.js';
import { renderSettingsView, renderContactsView, renderBlockedView, renderStorageView, renderNotificationsView } from './settings.js';
import { setReplyTo, getReplyTo, clearReplyTo, onReplyChange } from './lib/replyState.js';
import { renderComposer, renderEmojiPicker, renderAttachmentMenu } from './composer.js';
import { renderMessageContextMenu } from './messageActions.js';

let appRoot = null;
let currentScreen = 'auth';

export function initUI() {
  appRoot = $('#app');
  subscribe('auth', () => {
    if (state.user) {
      if (currentScreen !== 'app') renderAppShell();
    } else {
      currentScreen = 'auth';
    }
  });
  subscribe('chats', renderChatList);
  subscribe('messages', renderMessages);
  subscribe('typing', renderTypingIndicator);
  subscribe('settings', () => { applyTheme(); renderAppHeader(); });
  subscribe('openChat', () => { renderMainArea(); });
  subscribe('profile', () => { renderSidebarHeader(); });
}

// ---------- App Shell ----------
export function renderAppShell() {
  currentScreen = 'app';
  appRoot.innerHTML = '';
  const shell = el('div', { class: 'app-shell' });
  shell.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header" id="sidebar-header"></div>
      <div class="sidebar-search">
        <div class="search-wrap">
          ${Icon.search}
          <input class="input" type="text" id="global-search" placeholder="Search chats, users, messages..." />
        </div>
      </div>
      <div class="sidebar-nav" id="sidebar-nav"></div>
      <div class="list-area" id="list-area"></div>
    </aside>
    <main class="main-area hidden-mobile" id="main-area"></main>
    <nav class="bottom-nav" id="bottom-nav"></nav>
  `;
  appRoot.append(shell);

  renderSidebarHeader();
  renderSidebarNav();
  renderBottomNav();
  renderChatList();
  renderMainArea();

  // Search
  const searchInput = $('#global-search');
  searchInput.addEventListener('input', debounce((e) => handleGlobalSearch(e.target.value), 300));

  // Load data
  loadChats();
  loadStatuses();
  callHistory.load();
  renderNotificationsView();
}

function renderSidebarHeader() {
  const header = $('#sidebar-header');
  if (!header) return;
  header.innerHTML = `
    <div class="sidebar-brand">
      <img src="/nuvora-logo.svg" alt="NUVORA" />
      <span>NUVORA</span>
    </div>
    <div style="display:flex;gap:4px;">
      <button class="btn-icon" id="new-chat-btn" title="New chat">${Icon.edit}</button>
      <button class="btn-icon" id="menu-btn" title="Menu">${Icon.moreVertical}</button>
    </div>
  `;
  $('#new-chat-btn').addEventListener('click', showNewChatMenu);
  $('#menu-btn').addEventListener('click', showAppMenu);
}

function renderSidebarNav() {
  const nav = $('#sidebar-nav');
  if (!nav) return;
  const items = [
    { id: 'chats', label: 'Chats', icon: Icon.message },
    { id: 'status', label: 'Status', icon: Icon.circle },
    { id: 'calls', label: 'Calls', icon: Icon.phone },
    { id: 'contacts', label: 'Contacts', icon: Icon.contact },
    { id: 'nuvo', label: 'NUVO', icon: Icon.sparkles },
  ];
  nav.innerHTML = items.map(item => `
    <div class="nav-item ${state.activeView === item.id ? 'active' : ''}" data-view="${item.id}">
      ${item.icon}
      <span>${item.label}</span>
    </div>
  `).join('');
  nav.querySelectorAll('.nav-item').forEach(n => {
    n.addEventListener('click', () => switchView(n.dataset.view));
  });
}

function renderBottomNav() {
  const nav = $('#bottom-nav');
  if (!nav) return;
  const items = [
    { id: 'chats', label: 'Chats', icon: Icon.message },
    { id: 'status', label: 'Status', icon: Icon.circle },
    { id: 'calls', label: 'Calls', icon: Icon.phone },
    { id: 'nuvo', label: 'NUVO', icon: Icon.sparkles },
    { id: 'settings', label: 'Settings', icon: Icon.settings },
  ];
  nav.innerHTML = items.map(item => `
    <div class="bottom-nav-item ${state.activeView === item.id ? 'active' : ''}" data-view="${item.id}">
      ${item.icon}
      <span>${item.label}</span>
    </div>
  `).join('');
  nav.querySelectorAll('.bottom-nav-item').forEach(n => {
    n.addEventListener('click', () => switchView(n.dataset.view));
  });
}

function switchView(view) {
  setState({ activeView: view, activeChatId: view === 'chats' ? state.activeChatId : null });
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === view);
  });
  renderListArea();
  renderMainArea();
}

export function renderListArea() {
  const area = $('#list-area');
  if (!area) return;
  const view = state.activeView;
  if (view === 'chats') {
    renderChatList();
  } else if (view === 'status') {
    import('./status.js').then(m => m.renderStatusList(area));
  } else if (view === 'calls') {
    renderCallsList(area);
  } else if (view === 'contacts') {
    renderContactsView(area);
  } else if (view === 'nuvo') {
    area.innerHTML = `<div class="list-empty">${Icon.sparkles}<p>Your NUVO AI assistant</p></div>`;
  } else if (view === 'settings') {
    renderSettingsList(area);
  }
}

// ---------- Chat List ----------
export function renderChatList() {
  const area = $('#list-area');
  if (!area) return;
  if (state.activeView !== 'chats') return;
  const chats = state.chats.filter(c => !c.archived);
  if (chats.length === 0) {
    area.innerHTML = `
      <div class="list-empty">
        ${Icon.message}
        <p>No conversations yet.<br/>Tap the pencil icon to start chatting.</p>
      </div>
    `;
    return;
  }
  area.innerHTML = chats.map(chat => {
    const isActive = chat.id === state.activeChatId;
    const lastMsg = chat.last_message;
    let lastMsgText = '';
    if (lastMsg) {
      if (lastMsg.deleted_for_everyone) lastMsgText = 'This message was deleted';
      else if (lastMsg.message_type === 'text') lastMsgText = lastMsg.body;
      else if (lastMsg.message_type === 'image') lastMsgText = 'Photo';
      else if (lastMsg.message_type === 'video') lastMsgText = 'Video';
      else if (lastMsg.message_type === 'audio') lastMsgText = 'Audio';
      else if (lastMsg.message_type === 'voice') lastMsgText = 'Voice message';
      else if (lastMsg.message_type === 'file') lastMsgText = lastMsg.attachment_name || 'File';
      else lastMsgText = lastMsg.body || 'Attachment';
    }
    const isOutgoing = lastMsg?.sender_id === state.user.id;
    const tickIcon = isOutgoing && lastMsg && !lastMsg.deleted_for_everyone
      ? ((lastMsg.read_by || []).length > 1 ? Icon.checkCheck : Icon.check)
      : '';
    return `
      <div class="chat-item ${isActive ? 'active' : ''} ${chat.pinned ? 'chat-item-pinned' : ''}" data-chat-id="${chat.id}">
        ${avatarHTML({ display_name: chat.name, avatar_url: chat.avatar_url, is_online: chat.other_user?.is_online }, 'md')}
        <div class="chat-item-body">
          <div class="chat-item-top">
            <span class="chat-item-name">${escapeHtml(chat.name)}</span>
            <span class="chat-item-time">${lastMsg ? formatTime(lastMsg.created_at) : ''}</span>
          </div>
          <div class="chat-item-bottom">
            <span class="chat-item-msg">
              ${isOutgoing && tickIcon ? `<span class="tick">${tickIcon}</span>` : ''}
              ${escapeHtml(lastMsgText || 'No messages yet')}
            </span>
            <span style="display:flex;align-items:center;gap:6px;">
              ${chat.muted ? `<span class="chat-item-muted">${Icon.mute}</span>` : ''}
              ${chat.pinned ? `<span class="chat-item-pinned">${Icon.pin}</span>` : ''}
              ${chat.unread_count > 0 ? `<span class="chat-item-unread">${chat.unread_count}</span>` : ''}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  area.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      const chatId = item.dataset.chatId;
      openChat(chatId);
      // On mobile, show main area
      $('#main-area')?.classList.remove('hidden-mobile');
      $('#sidebar')?.classList.add('hidden-mobile');
    });
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showChatContextMenu(e, item.dataset.chatId);
    });
  });
}

function showChatContextMenu(e, chatId) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;
  const menu = el('div', { class: 'context-menu', style: `top:${e.clientY}px;left:${e.clientX}px;` });
  const items = [
    { label: chat.pinned ? 'Unpin chat' : 'Pin chat', icon: Icon.pin, action: () => pinChat(chatId, !chat.pinned) },
    { label: chat.muted ? 'Unmute' : 'Mute', icon: Icon.mute, action: () => muteChat(chatId, !chat.muted) },
    { label: chat.archived ? 'Unarchive' : 'Archive', icon: Icon.archive, action: () => archiveChat(chatId, !chat.archived) },
    { label: 'Clear history', icon: Icon.trash, action: () => clearChatHistory(chatId), danger: true },
    { label: 'Delete chat', icon: Icon.trash2, action: () => deleteChat(chatId), danger: true },
  ];
  menu.innerHTML = items.map((it, i) => `
    <div class="context-menu-item ${it.danger ? 'danger' : ''}" data-idx="${i}">${it.icon}<span>${it.label}</span></div>
  `).join('');
  document.body.append(menu);
  menu.querySelectorAll('.context-menu-item').forEach((mi, i) => {
    mi.addEventListener('click', () => { menu.remove(); items[i].action(); });
  });
  setTimeout(() => {
    document.addEventListener('click', function rm() { menu.remove(); document.removeEventListener('click', rm); });
  }, 100);
}

// ---------- Main Area ----------
export function renderMainArea() {
  const main = $('#main-area');
  if (!main) return;
  const view = state.activeView;
  if (view === 'nuvo') {
    renderNuvoView(main);
    return;
  }
  if (view === 'settings') {
    renderSettingsView(main);
    return;
  }
  if (view === 'status') {
    renderStatusView(main);
    return;
  }
  if (view === 'calls') {
    renderCallsView(main);
    return;
  }
  if (view === 'contacts') {
    renderContactsMain(main);
    return;
  }
  // chats view
  if (state.activeChatId) {
    renderChatView(main, state.activeChatId);
  } else {
    main.innerHTML = `
      <div class="empty-state">
        <img src="/nuvora-logo.svg" alt="NUVORA" />
        <h2>Welcome to NUVORA</h2>
        <p>Select a conversation to start messaging, or tap the pencil icon to begin a new chat with anyone around the world.</p>
      </div>
    `;
  }
}

export function renderAppHeader() {
  // re-render sidebar header if profile changed
  renderSidebarHeader();
}

// ---------- Chat View ----------
async function renderChatView(main, chatId) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) { main.innerHTML = '<div class="empty-state"><p>Chat not found</p></div>'; return; }

  main.innerHTML = `
    <div class="chat-view">
      <div class="main-header" id="chat-header">
        <button class="btn-icon" id="back-btn">${Icon.arrowLeft}</button>
        <div class="main-header-info" id="chat-header-info">
          ${avatarHTML({ display_name: chat.name, avatar_url: chat.avatar_url, is_online: chat.other_user?.is_online }, 'sm')}
          <div style="min-width:0;">
            <div class="main-header-title">${escapeHtml(chat.name)}</div>
            <div class="main-header-sub" id="chat-sub-status">${chat.other_user ? formatLastSeenShort(chat.other_user) : (chat.type === 'group' ? 'Group chat' : '')}</div>
          </div>
        </div>
        <div style="display:flex;gap:4px;">
          ${chat.type === 'direct' ? `<button class="btn-icon" id="call-voice-btn" title="Voice call">${Icon.phone}</button>` : ''}
          ${chat.type === 'direct' ? `<button class="btn-icon" id="call-video-btn" title="Video call">${Icon.video}</button>` : ''}
          <button class="btn-icon" id="chat-menu-btn" title="More">${Icon.moreVertical}</button>
        </div>
      </div>
      <div class="chat-messages chat-bg-pattern" id="chat-messages"></div>
      <div id="reply-bar-container"></div>
      <div id="composer-container"></div>
    </div>
  `;

  $('#back-btn').addEventListener('click', () => {
    $('#main-area')?.classList.add('hidden-mobile');
    $('#sidebar')?.classList.remove('hidden-mobile');
  });

  $('#chat-header-info').addEventListener('click', () => {
    if (chat.type === 'direct' && chat.other_user) {
      showProfileModal(chat.other_user.id, { fromChat: true });
    } else if (chat.type === 'group') {
      showGroupInfo(chatId);
    }
  });

  $('#call-voice-btn')?.addEventListener('click', () => startCall(chat, 'voice'));
  $('#call-video-btn')?.addEventListener('click', () => startCall(chat, 'video'));
  $('#chat-menu-btn')?.addEventListener('click', () => showChatMenu(chatId));

  renderMessages();
  renderComposer($('#composer-container'), chatId);
}

function formatLastSeenShort(user) {
  if (user.is_online) return 'online';
  if (!user.last_seen) return 'offline';
  const d = new Date(user.last_seen);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'last seen just now';
  if (diff < 3600) return `last seen ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `last seen ${Math.floor(diff / 3600)}h ago`;
  return `last seen ${formatDate(user.last_seen)}`;
}

// ---------- Messages Rendering ----------
// Reply state is managed in lib/replyState.js
export { setReplyTo, getReplyTo, clearReplyTo };

function renderReplyBar() {
  const container = $('#reply-bar-container');
  if (!container) return;
  const replyToMessage = getReplyTo();
  if (!replyToMessage) { container.innerHTML = ''; return; }
  const senderName = replyToMessage.sender?.display_name || 'User';
  const preview = replyToMessage.deleted_for_everyone ? 'deleted message' : (replyToMessage.body || replyToMessage.attachment_name || 'attachment');
  container.innerHTML = `
    <div class="composer-reply-bar">
      ${Icon.reply}
      <div class="reply-info">
        <div style="font-weight:600;font-size:13px;color:var(--brand);">${escapeHtml(senderName)}</div>
        <div style="font-size:13px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(preview)}</div>
      </div>
      <button class="btn-icon" id="cancel-reply">${Icon.x}</button>
    </div>
  `;
  $('#cancel-reply').addEventListener('click', clearReplyTo);
}

// Subscribe to reply state changes to re-render the bar
onReplyChange(() => renderReplyBar());

export function renderMessages() {
  const container = $('#chat-messages');
  if (!container) return;
  const messages = getMessages();
  if (messages.length === 0) {
    container.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;">No messages yet. Say hello!</div>`;
    return;
  }

  let html = '';
  let lastDate = '';
  for (const msg of messages) {
    // Skip messages deleted for me
    if ((msg.deleted_for_me_by || []).includes(state.user.id)) continue;

    const dateStr = formatDate(msg.created_at);
    if (dateStr !== lastDate) {
      html += `<div class="date-sep"><span>${dateStr}</span></div>`;
      lastDate = dateStr;
    }

    const isOut = msg.sender_id === state.user.id;
    const isDeleted = msg.deleted_for_everyone;
    const isStarred = (msg.starred_by || []).includes(state.user.id);
    const isEdited = !!msg.edited_at;
    const readBy = msg.read_by || [];
    const isRead = readBy.length > 1 || (readBy.length === 1 && readBy[0] !== state.user.id);

    // Sender name in group
    let senderName = '';
    const chat = state.chats.find(c => c.id === state.activeChatId);
    if (chat?.type === 'group' && !isOut && !isDeleted) {
      senderName = `<div style="font-size:12px;font-weight:600;color:var(--brand);margin-bottom:2px;">${escapeHtml(msg.sender?.display_name || 'Unknown')}</div>`;
    }

    // Reply preview
    let replyPreview = '';
    if (msg.reply_to) {
      const replySender = msg.reply_to.sender_id === state.user.id ? 'You' : (messages.find(m => m.id === msg.reply_to?.id)?.sender?.display_name || 'User');
      const replyText = msg.reply_to.deleted_for_everyone ? 'deleted message' : (msg.reply_to.body || msg.reply_to.attachment_name || 'attachment');
      replyPreview = `
        <div class="msg-reply-preview">
          <div class="reply-name">${escapeHtml(replySender)}</div>
          <div class="reply-text">${escapeHtml(replyText)}</div>
        </div>
      `;
    }

    // Forwarded label
    let forwardedLabel = msg.forwarded_from ? `<div style="font-size:11px;color:var(--text-muted);font-style:italic;margin-bottom:2px;">Forwarded</div>` : '';

    // Content
    let content = '';
    if (isDeleted) {
      content = `<span style="font-style:italic;color:var(--text-muted);">This message was deleted</span>`;
    } else if (msg.message_type === 'text') {
      content = `<div class="msg-text">${linkify(msg.body)}</div>`;
    } else if (msg.message_type === 'image') {
      content = `<div class="msg-attachment" data-url="${escapeHtml(msg.attachment_url)}"><img src="${escapeHtml(msg.attachment_url)}" alt="image" loading="lazy" /></div>${msg.body ? `<div class="msg-text">${linkify(msg.body)}</div>` : ''}`;
    } else if (msg.message_type === 'video') {
      content = `<div class="msg-attachment"><video src="${escapeHtml(msg.attachment_url)}" controls preload="metadata"></video></div>${msg.body ? `<div class="msg-text">${linkify(msg.body)}</div>` : ''}`;
    } else if (msg.message_type === 'audio') {
      content = `<div class="msg-attachment"><audio src="${escapeHtml(msg.attachment_url)}" controls></audio>${msg.body ? `<div class="msg-text">${linkify(msg.body)}</div>` : ''}`;
    } else if (msg.message_type === 'voice') {
      content = renderVoiceMessage(msg);
    } else if (msg.message_type === 'file') {
      content = `<div class="msg-file" data-url="${escapeHtml(msg.attachment_url)}">
        ${Icon.file}
        <div class="msg-file-info">
          <span class="msg-file-name">${escapeHtml(msg.attachment_name || 'File')}</span>
          <span class="msg-file-size">${formatFileSize(msg.attachment_size)}</span>
        </div>
        ${Icon.download}
      </div>${msg.body ? `<div class="msg-text">${linkify(msg.body)}</div>` : ''}`;
    }

    // Reactions
    let reactionsHtml = '';
    if (msg.reactions && msg.reactions.length > 0) {
      const grouped = {};
      (msg.reactions || []).forEach(r => {
        if (!grouped[r.emoji]) grouped[r.emoji] = [];
        grouped[r.emoji].push(r);
      });
      reactionsHtml = `<div class="msg-reactions">${Object.entries(grouped).map(([emoji, users]) => `
        <span class="msg-reaction ${users.some(u => u.user_id === state.user.id) ? 'mine' : ''}" data-msg-id="${msg.id}" data-emoji="${emoji}">${emoji}<span class="count">${users.length}</span></span>
      `).join('')}</div>`;
    }

    // Tick
    let tickHtml = '';
    if (isOut && !isDeleted) {
      if (isRead) tickHtml = `<span class="tick read">${Icon.checkCheck}</span>`;
      else tickHtml = `<span class="tick sent">${Icon.check}</span>`;
    }

    html += `
      <div class="msg ${isOut ? 'out' : 'in'}" data-msg-id="${msg.id}">
        <div class="msg-bubble">
          <button class="msg-actions-trigger" data-msg-id="${msg.id}">${Icon.moreHorizontal}</button>
          ${forwardedLabel}
          ${senderName}
          ${replyPreview}
          ${content}
          <div class="msg-meta">
            ${isEdited ? '<span class="msg-edited">edited</span>' : ''}
            ${isStarred ? Icon.starFilled : ''}
            <span>${formatTime(msg.created_at)}</span>
            ${tickHtml}
          </div>
          ${reactionsHtml}
        </div>
      </div>
    `;
  }
  container.innerHTML = html;

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;

  // Attach event listeners
  container.querySelectorAll('.msg-actions-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const msgId = btn.dataset.msgId;
      const msg = messages.find(m => m.id === msgId);
      if (msg) renderMessageContextMenu(e, msg);
    });
  });

  container.querySelectorAll('.msg-reaction').forEach(r => {
    r.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleReaction(r.dataset.msgId, r.dataset.emoji);
    });
  });

  container.querySelectorAll('.msg-attachment').forEach(a => {
    a.addEventListener('click', (e) => {
      const url = a.dataset.url;
      if (url) window.open(url, '_blank');
    });
  });

  container.querySelectorAll('.msg-file').forEach(f => {
    f.addEventListener('click', (e) => {
      const url = f.dataset.url;
      if (url) window.open(url, '_blank');
    });
  });

  // Long-press / right-click for context menu
  container.querySelectorAll('.msg-bubble').forEach(bubble => {
    const msgId = bubble.closest('.msg').dataset.msgId;
    bubble.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const msg = messages.find(m => m.id === msgId);
      if (msg) renderMessageContextMenu(e, msg);
    });
    // Long press on mobile
    let pressTimer;
    bubble.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        const msg = messages.find(m => m.id === msgId);
        if (msg) {
          const touch = e.touches[0];
          renderMessageContextMenu({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} }, msg);
        }
      }, 500);
    });
    bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
    bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));
  });
}

function renderVoiceMessage(msg) {
  const duration = msg.attachment_name ? parseInt(msg.attachment_name) : 0;
  return `
    <div class="msg-voice" data-url="${escapeHtml(msg.attachment_url)}" data-duration="${duration}">
      <button class="voice-play">${Icon.play}</button>
      <div class="voice-wave" id="wave-${msg.id}">
        ${Array.from({length: 24}, (_, i) => `<div class="voice-bar" style="height:${Math.random()*20+8}px"></div>`).join('')}
      </div>
      <span class="voice-dur">${formatDuration(duration)}</span>
    </div>
  `;
}

// ---------- Typing indicator ----------
function renderTypingIndicator(data) {
  const sub = $('#chat-sub-status');
  if (!sub) return;
  const chat = state.chats.find(c => c.id === state.activeChatId);
  if (!chat) return;
  if (data && data.chatId === state.activeChatId) {
    sub.textContent = `${data.name} is typing...`;
  } else if (chat.other_user) {
    sub.textContent = formatLastSeenShort(chat.other_user);
  } else if (chat.type === 'group') {
    sub.textContent = 'Group chat';
  }
}

// ---------- New Chat Menu ----------
function showNewChatMenu() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'New Chat' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('button', { class: 'btn btn-ghost btn-block', style: 'justify-content:flex-start;gap:12px;margin-bottom:8px;', onclick: () => { closeModal(content.closest('.modal-overlay')); showNewGroupModal(); }, html: `${Icon.users} <span>New Group</span>` }),
      el('button', { class: 'btn btn-ghost btn-block', style: 'justify-content:flex-start;gap:12px;margin-bottom:8px;', onclick: () => { closeModal(content.closest('.modal-overlay')); showNewContactModal(); }, html: `${Icon.userPlus} <span>New Contact</span>` }),
      el('button', { class: 'btn btn-ghost btn-block', style: 'justify-content:flex-start;gap:12px;margin-bottom:8px;', onclick: () => { closeModal(content.closest('.modal-overlay')); showBroadcastModal(); }, html: `${Icon.broadcast} <span>New Broadcast</span>` }),
    ]),
  ]);
  showModal(content);
}

function showNewContactModal() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Find People' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { class: 'search-wrap mb-4' }, [
        `${Icon.search}`,
        el('input', { class: 'input', id: 'user-search', placeholder: 'Search by username or name...', style: 'padding-left:38px;' }),
      ]),
      el('div', { id: 'user-search-results' }, ''),
    ]),
  ]);
  showModal(content);
  $('#user-search').addEventListener('input', debounce(async (e) => {
    const results = await searchUsers(e.target.value);
    const list = $('#user-search-results');
    if (results.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">No users found</p>';
      return;
    }
    list.innerHTML = results.map(u => `
      <div class="member-item" data-user-id="${u.id}">
        ${avatarHTML(u, 'md')}
        <div class="member-info">
          <div class="member-name">${escapeHtml(u.display_name)}</div>
          <div style="font-size:13px;color:var(--text-muted);">@${escapeHtml(u.username)}</div>
        </div>
        <button class="btn btn-sm btn-primary">Message</button>
      </div>
    `).join('');
    list.querySelectorAll('.member-item').forEach(item => {
      item.addEventListener('click', async () => {
        const userId = item.dataset.userId;
        closeModal(content.closest('.modal-overlay'));
        const chatId = await createDirectChat(userId);
        if (chatId) {
          // add to contacts
          await supabase.from('contacts').insert({ user_id: state.user.id, contact_id: userId }).upsert({ user_id: state.user.id, contact_id: userId });
          openChat(chatId);
          $('#main-area')?.classList.remove('hidden-mobile');
          $('#sidebar')?.classList.add('hidden-mobile');
        }
      });
    });
  }, 300));
}

function showNewGroupModal() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'New Group' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Group Name' }),
        el('input', { class: 'input', id: 'group-name', placeholder: 'My Group' }),
      ]),
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Description (optional)' }),
        el('textarea', { class: 'textarea', id: 'group-desc', placeholder: 'What is this group about?' }),
      ]),
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Add Members' }),
        el('div', { class: 'search-wrap' }, [
          Icon.search,
          el('input', { class: 'input', id: 'member-search', placeholder: 'Search contacts...', style: 'padding-left:38px;' }),
        ]),
        el('div', { id: 'member-search-results', style: 'margin-top:12px;' }, ''),
      ]),
      el('div', { id: 'selected-members', style: 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;' }, ''),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => closeModal(content.closest('.modal-overlay')) }, 'Cancel'),
      el('button', { class: 'btn btn-primary', id: 'create-group-btn' }, 'Create Group'),
    ]),
  ]);
  showModal(content);

  const selected = new Set();
  $('#member-search').addEventListener('input', debounce(async (e) => {
    const results = await searchUsers(e.target.value);
    const list = $('#member-search-results');
    list.innerHTML = results.map(u => `
      <div class="member-item" data-user-id="${u.id}">
        ${avatarHTML(u, 'sm')}
        <div class="member-info">
          <div class="member-name">${escapeHtml(u.display_name)}</div>
          <div style="font-size:12px;color:var(--text-muted);">@${escapeHtml(u.username)}</div>
        </div>
        <span style="font-size:20px;color:${selected.has(u.id) ? 'var(--brand)' : 'var(--border-strong)'}">${selected.has(u.id) ? Icon.check : Icon.plus}</span>
      </div>
    `).join('');
    list.querySelectorAll('.member-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.userId;
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        $('#member-search').dispatchEvent(new Event('input'));
        renderSelectedMembers();
      });
    });
  }, 300));

  function renderSelectedMembers() {
    const cont = $('#selected-members');
    cont.innerHTML = '';
    selected.forEach(id => {
      const tag = el('span', { class: 'btn btn-sm', style: 'background:var(--brand-light);color:var(--brand);' }, `${id.slice(0, 8)}... ${Icon.x}`);
      tag.addEventListener('click', () => { selected.delete(id); renderSelectedMembers(); });
      cont.append(tag);
    });
  }

  $('#create-group-btn').addEventListener('click', async () => {
    const name = $('#group-name').value.trim();
    const desc = $('#group-desc').value.trim();
    if (!name) { toast('Group name required', 'error'); return; }
    if (selected.size === 0) { toast('Add at least one member', 'error'); return; }
    const chatId = await createGroup(name, desc, Array.from(selected));
    if (chatId) {
      closeModal(content.closest('.modal-overlay'));
      openChat(chatId);
      $('#main-area')?.classList.remove('hidden-mobile');
      $('#sidebar')?.classList.add('hidden-mobile');
    }
  });
}

function showBroadcastModal() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'New Broadcast' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('p', { class: 'mb-4 text-secondary', text: 'Send a message to multiple contacts. Each recipient gets a separate direct chat.' }),
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Broadcast Message' }),
        el('textarea', { class: 'textarea', id: 'broadcast-msg', placeholder: 'Type your message...' }),
      ]),
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Select Recipients' }),
        el('div', { class: 'search-wrap' }, [
          Icon.search,
          el('input', { class: 'input', id: 'broadcast-search', placeholder: 'Search contacts...', style: 'padding-left:38px;' }),
        ]),
        el('div', { id: 'broadcast-results', style: 'margin-top:12px;' }, ''),
      ]),
      el('div', { id: 'broadcast-selected', style: 'display:flex;flex-wrap:wrap;gap:6px;' }, ''),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => closeModal(content.closest('.modal-overlay')) }, 'Cancel'),
      el('button', { class: 'btn btn-primary', id: 'send-broadcast-btn' }, 'Send Broadcast'),
    ]),
  ]);
  showModal(content);

  const selected = new Set();
  $('#broadcast-search').addEventListener('input', debounce(async (e) => {
    const results = await searchUsers(e.target.value);
    const list = $('#broadcast-results');
    list.innerHTML = results.map(u => `
      <div class="member-item" data-user-id="${u.id}">
        ${avatarHTML(u, 'sm')}
        <div class="member-info">
          <div class="member-name">${escapeHtml(u.display_name)}</div>
          <div style="font-size:12px;color:var(--text-muted);">@${escapeHtml(u.username)}</div>
        </div>
        <span style="font-size:20px;color:${selected.has(u.id) ? 'var(--brand)' : 'var(--border-strong)'}">${selected.has(u.id) ? Icon.check : Icon.plus}</span>
      </div>
    `).join('');
    list.querySelectorAll('.member-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.userId;
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        $('#broadcast-search').dispatchEvent(new Event('input'));
        renderSelected();
      });
    });
  }, 300));

  function renderSelected() {
    const cont = $('#broadcast-selected');
    cont.innerHTML = '';
    selected.forEach(id => {
      const tag = el('span', { class: 'btn btn-sm', style: 'background:var(--brand-light);color:var(--brand);' }, `${id.slice(0,8)}... ${Icon.x}`);
      tag.addEventListener('click', () => { selected.delete(id); renderSelected(); });
      cont.append(tag);
    });
  }

  $('#send-broadcast-btn').addEventListener('click', async () => {
    const msg = $('#broadcast-msg').value.trim();
    if (!msg) { toast('Message required', 'error'); return; }
    if (selected.size === 0) { toast('Select at least one recipient', 'error'); return; }
    for (const userId of selected) {
      const chatId = await createDirectChat(userId);
      if (chatId) await sendMessage(chatId, msg);
    }
    toast('Broadcast sent', 'success');
    closeModal(content.closest('.modal-overlay'));
    loadChats();
  });
}

// ---------- App Menu ----------
function showAppMenu() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Menu' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('button', { class: 'btn btn-ghost btn-block', style: 'justify-content:flex-start;gap:12px;margin-bottom:8px;', onclick: () => { closeModal(content.closest('.modal-overlay')); showEditProfileModal(); }, html: `${Icon.user} <span>Profile</span>` }),
      el('button', { class: 'btn btn-ghost btn-block', style: 'justify-content:flex-start;gap:12px;margin-bottom:8px;', onclick: () => { closeModal(content.closest('.modal-overlay')); switchView('settings'); }, html: `${Icon.settings} <span>Settings</span>` }),
      el('button', { class: 'btn btn-ghost btn-block', style: 'justify-content:flex-start;gap:12px;margin-bottom:8px;', onclick: () => { closeModal(content.closest('.modal-overlay')); switchView('nuvo'); }, html: `${Icon.sparkles} <span>NUVO Assistant</span>` }),
      el('button', { class: 'btn btn-danger btn-block', style: 'justify-content:flex-start;gap:12px;', onclick: async () => { closeModal(content.closest('.modal-overlay')); await logout(); }, html: `${Icon.logout} <span>Log Out</span>` }),
    ]),
  ]);
  showModal(content);
}

// ---------- Chat Menu ----------
function showChatMenu(chatId) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;
  const items = [
    { label: 'View contact', icon: Icon.user, action: () => { if (chat.other_user) showProfileModal(chat.other_user.id, { fromChat: true }); else showGroupInfo(chatId); } },
    { label: chat.muted ? 'Unmute' : 'Mute', icon: Icon.mute, action: () => muteChat(chatId, !chat.muted) },
    { label: 'Search messages', icon: Icon.search, action: () => showChatSearch(chatId) },
    { label: chat.pinned ? 'Unpin' : 'Pin', icon: Icon.pin, action: () => pinChat(chatId, !chat.pinned) },
    { label: 'Clear history', icon: Icon.trash, action: () => clearChatHistory(chatId), danger: true },
    { label: 'Delete chat', icon: Icon.trash2, action: () => deleteChat(chatId), danger: true },
  ];
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Chat Options' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, items.map((it, i) =>
      el('button', { class: `btn btn-ghost btn-block ${it.danger ? 'btn-danger' : ''}`, style: 'justify-content:flex-start;gap:12px;margin-bottom:8px;', onclick: () => { closeModal(content.closest('.modal-overlay')); it.action(); }, html: `${it.icon} <span>${it.label}</span>` })
    )),
  ]);
  showModal(content);
}

function showChatSearch(chatId) {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Search Messages' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { class: 'search-wrap mb-4' }, [
        Icon.search,
        el('input', { class: 'input', id: 'chat-search-input', placeholder: 'Search in this chat...', style: 'padding-left:38px;' }),
      ]),
      el('div', { id: 'chat-search-results' }, ''),
    ]),
  ]);
  showModal(content);
  $('#chat-search-input').addEventListener('input', debounce(async (e) => {
    const results = await searchMessages(e.target.value, chatId);
    const list = $('#chat-search-results');
    if (results.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">No results</p>';
      return;
    }
    list.innerHTML = results.map(m => `
      <div class="member-item" data-msg-id="${m.id}">
        <div class="member-info">
          <div class="member-name">${escapeHtml(m.body?.slice(0, 60) || 'Attachment')}</div>
          <div style="font-size:12px;color:var(--text-muted);">${formatDateTime(m.created_at)}</div>
        </div>
      </div>
    `).join('');
  }, 300));
}

// ---------- Global Search ----------
async function handleGlobalSearch(query) {
  if (!query || query.length < 2) {
    renderChatList();
    return;
  }
  const area = $('#list-area');
  // Search users
  const users = await searchUsers(query);
  // Search messages
  const msgs = await searchMessages(query);
  // Filter chats
  const matchedChats = state.chats.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

  area.innerHTML = '';
  if (matchedChats.length > 0) {
    area.innerHTML += `<div class="detail-section-title" style="padding:12px 16px;">Chats</div>`;
    matchedChats.forEach(chat => {
      area.innerHTML += `
        <div class="chat-item" data-chat-id="${chat.id}">
          ${avatarHTML({ display_name: chat.name, avatar_url: chat.avatar_url }, 'md')}
          <div class="chat-item-body"><div class="chat-item-name">${escapeHtml(chat.name)}</div></div>
        </div>
      `;
    });
  }
  if (users.length > 0) {
    area.innerHTML += `<div class="detail-section-title" style="padding:12px 16px;">People</div>`;
    users.forEach(u => {
      area.innerHTML += `
        <div class="member-item" data-user-id="${u.id}">
          ${avatarHTML(u, 'md')}
          <div class="member-info">
            <div class="member-name">${escapeHtml(u.display_name)}</div>
            <div style="font-size:12px;color:var(--text-muted);">@${escapeHtml(u.username)}</div>
          </div>
        </div>
      `;
    });
  }
  if (msgs.length > 0) {
    area.innerHTML += `<div class="detail-section-title" style="padding:12px 16px;">Messages</div>`;
    msgs.forEach(m => {
      area.innerHTML += `
        <div class="member-item" data-msg-id="${m.id}">
          <div class="member-info">
            <div class="member-name">${escapeHtml(m.body?.slice(0, 60) || 'Attachment')}</div>
            <div style="font-size:12px;color:var(--text-muted);">${formatDateTime(m.created_at)}</div>
          </div>
        </div>
      `;
    });
  }
  if (matchedChats.length === 0 && users.length === 0 && msgs.length === 0) {
    area.innerHTML = '<div class="list-empty"><p>No results found</p></div>';
  }
  area.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      openChat(item.dataset.chatId);
      $('#main-area')?.classList.remove('hidden-mobile');
      $('#sidebar')?.classList.add('hidden-mobile');
    });
  });
  area.querySelectorAll('.member-item[data-user-id]').forEach(item => {
    item.addEventListener('click', () => showProfileModal(item.dataset.userId));
  });
}

// ---------- Calls List ----------
function renderCallsList(area) {
  const calls = callHistory.all();
  if (calls.length === 0) {
    area.innerHTML = `<div class="list-empty">${Icon.phone}<p>No recent calls</p></div>`;
    return;
  }
  area.innerHTML = calls.map(c => {
    const isOutgoing = c.direction === 'outgoing';
    const isMissed = c.status === 'missed';
    const iconClass = isMissed ? 'missed' : (isOutgoing ? 'outgoing' : 'incoming');
    const icon = isMissed ? Icon.phoneMissed : (isOutgoing ? Icon.phoneOutgoing : Icon.phoneIncoming);
    const otherId = isOutgoing ? c.callee_id : c.caller_id;
    return `
      <div class="call-item" data-call-id="${c.id}" data-user-id="${otherId}" data-call-type="${c.call_type}">
        <div class="call-icon ${iconClass}">${icon}</div>
        <div class="member-info">
          <div class="member-name">${escapeHtml(c.peer_name || 'Unknown')}</div>
          <div style="font-size:12px;color:var(--text-muted);">${formatDateTime(c.created_at)} ${c.duration ? '· ' + formatDuration(c.duration) : ''}</div>
        </div>
        <button class="btn-icon" data-callback="true">${Icon.phone}</button>
      </div>
    `;
  }).join('');
  area.querySelectorAll('.call-item').forEach(item => {
    item.addEventListener('click', () => {
      const userId = item.dataset.userId;
      const callType = item.dataset.callType;
      getProfile(userId).then(profile => {
        if (profile) {
          const fakeChat = { type: 'direct', other_user: profile, name: profile.display_name };
          startCall(fakeChat, callType);
        }
      });
    });
  });
}

// ---------- Start Call ----------
async function startCall(chat, type) {
  if (!chat.other_user) { toast('Can only call direct chats', 'error'); return; }
  const { openCall } = await import('./calls.js');
  openCall(chat.other_user.id, type, chat.other_user);
}

// ---------- Settings List (sidebar) ----------
function renderSettingsList(area) {
  area.innerHTML = `
    <div class="settings-section">
      <div class="settings-item" data-setting="profile">
        <div class="settings-item-icon" style="background:var(--brand-light);color:var(--brand);">${Icon.user}</div>
        <div class="settings-item-body"><div class="settings-item-title">Profile</div><div class="settings-item-sub">${escapeHtml(state.profile?.display_name || '')}</div></div>
      </div>
      <div class="settings-item" data-setting="account">
        <div class="settings-item-icon" style="background:rgba(59,130,246,0.15);color:var(--info);">${Icon.key}</div>
        <div class="settings-item-body"><div class="settings-item-title">Account</div><div class="settings-item-sub">${escapeHtml(state.user?.email || '')}</div></div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-item" data-setting="privacy">
        <div class="settings-item-icon" style="background:rgba(245,158,11,0.15);color:var(--warning);">${Icon.lock}</div>
        <div class="settings-item-body"><div class="settings-item-title">Privacy</div></div>
        ${Icon.chevronRight}
      </div>
      <div class="settings-item" data-setting="security">
        <div class="settings-item-icon" style="background:rgba(34,197,94,0.15);color:var(--success);">${Icon.shield}</div>
        <div class="settings-item-body"><div class="settings-item-title">Security</div></div>
        ${Icon.chevronRight}
      </div>
      <div class="settings-item" data-setting="notifications">
        <div class="settings-item-icon" style="background:rgba(239,68,68,0.15);color:var(--error);">${Icon.bell}</div>
        <div class="settings-item-body"><div class="settings-item-title">Notifications</div></div>
        ${Icon.chevronRight}
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-item" data-setting="appearance">
        <div class="settings-item-icon" style="background:rgba(139,92,246,0.15);color:var(--nuvo);">${Icon.palette}</div>
        <div class="settings-item-body"><div class="settings-item-title">Appearance</div><div class="settings-item-sub">${state.settings?.theme || 'system'}</div></div>
        ${Icon.chevronRight}
      </div>
      <div class="settings-item" data-setting="storage">
        <div class="settings-item-icon" style="background:rgba(20,184,166,0.15);color:var(--accent);">${Icon.database}</div>
        <div class="settings-item-body"><div class="settings-item-title">Storage & Data</div></div>
        ${Icon.chevronRight}
      </div>
      <div class="settings-item" data-setting="blocked">
        <div class="settings-item-icon" style="background:rgba(239,68,68,0.15);color:var(--error);">${Icon.block}</div>
        <div class="settings-item-body"><div class="settings-item-title">Blocked</div></div>
        ${Icon.chevronRight}
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-item" data-setting="help">
        <div class="settings-item-icon" style="background:var(--bg-active);color:var(--text-secondary);">${Icon.help}</div>
        <div class="settings-item-body"><div class="settings-item-title">Help</div></div>
        ${Icon.chevronRight}
      </div>
      <div class="settings-item" data-setting="about">
        <div class="settings-item-icon" style="background:var(--bg-active);color:var(--text-secondary);">${Icon.info}</div>
        <div class="settings-item-body"><div class="settings-item-title">About NUVORA</div></div>
        ${Icon.chevronRight}
      </div>
    </div>
    <div style="padding:16px;">
      <button class="btn btn-danger btn-block" id="settings-logout">${Icon.logout} Log Out</button>
    </div>
  `;
  area.querySelectorAll('.settings-item').forEach(item => {
    item.addEventListener('click', () => {
      const setting = item.dataset.setting;
      if (setting === 'profile') showEditProfileModal();
      else { state.activeView = 'settings'; renderSettingsView($('#main-area'), setting); }
    });
  });
  $('#settings-logout')?.addEventListener('click', logout);
}

// ---------- Contacts Main ----------
function renderContactsMain(main) {
  main.innerHTML = `
    <div class="main-header">
      <div class="main-header-title">Contacts</div>
      <button class="btn-icon" id="add-contact-btn">${Icon.userPlus}</button>
    </div>
    <div class="main-content" id="contacts-main-list"></div>
  `;
  $('#add-contact-btn').addEventListener('click', showNewContactModal);
  renderContactsView($('#contacts-main-list'));
}

// Expose for cross-module use
window.nuvoraOpenChat = (chatId) => {
  openChat(chatId);
  $('#main-area')?.classList.remove('hidden-mobile');
  $('#sidebar')?.classList.add('hidden-mobile');
};
