// js/chat.js
import { supabase } from './lib/supabase.js';
import { state, setState, emit, subscribe } from './lib/state.js';
import { $, el, toast, escapeHtml, avatarHTML, formatTime, formatDate, formatDateTime, formatFileSize, formatDuration, showModal, closeModal, confirmDialog, debounce, uuid, toggleArray, getMediaType, linkify } from './lib/utils.js';
import { Icon } from './lib/icons.js';
import { getProfile } from './profile.js';
import { openCall, getCallState } from './calls.js';

let messagesSubscription = null;
let typingTimeout = null;
let typingChannel = null;

// ---------- Load chats list ----------
export async function loadChats() {
  if (!state.user) return;
  const { data: memberships } = await supabase
    .from('chat_members')
    .select(`
      *,
      chats!inner(*),
      chats.chat_members(user_id, profiles!chat_members_user_id_fkey(username, display_name, avatar_url, is_online, last_seen))
    `)
    .eq('user_id', state.user.id)
    .order('pinned', { ascending: false });

  if (!memberships) return;

  const chats = [];
  for (const m of memberships) {
    const chat = m.chats;
    if (!chat) continue;
    // Get last message
    const { data: lastMsg } = await supabase
      .from('messages')
      .select('body, message_type, sender_id, created_at, deleted_for_everyone, attachment_name')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Build display name for direct chats
    let displayName = chat.name;
    let displayAvatar = chat.avatar_url;
    let otherUser = null;
    if (chat.type === 'direct') {
      const otherMember = chat.chat_members?.find(cm => cm.user_id !== state.user.id);
      if (otherMember?.profiles) {
        otherUser = otherMember.profiles;
        displayName = otherUser.display_name;
        displayAvatar = otherUser.avatar_url;
      }
    }

    chats.push({
      id: chat.id,
      type: chat.type,
      name: displayName || chat.name || 'Unnamed',
      avatar_url: displayAvatar,
      description: chat.description,
      only_admins_can_message: chat.only_admins_can_message,
      created_by: chat.created_by,
      other_user: otherUser,
      last_message: lastMsg || null,
      unread_count: m.unread_count || 0,
      muted: m.muted,
      archived: m.archived,
      pinned: m.pinned,
      last_read_message_id: m.last_read_message_id,
      role: m.role,
      updated_at: chat.updated_at,
    });
  }

  // Sort: pinned first, then by last message time
  chats.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aTime = a.last_message?.created_at || a.updated_at || 0;
    const bTime = b.last_message?.created_at || b.updated_at || 0;
    return new Date(bTime) - new Date(aTime);
  });

  state.chats = chats;
  emit('chats', state.chats);
  return chats;
}

export function subscribeChatsRealtime() {
  if (!state.user) return;
  supabase.channel('chats-list')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'messages',
    }, () => { loadChats(); })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'chat_members',
      filter: `user_id=eq.${state.user.id}`,
    }, () => { loadChats(); })
    .subscribe();
}

// ---------- Open chat ----------
export async function openChat(chatId) {
  setState({ activeChatId: chatId, activeView: 'chats' });
  emit('openChat', chatId);
  await markChatRead(chatId);
  await loadMessages(chatId);
  subscribeMessages(chatId);
  subscribeTyping(chatId);
}

export async function markChatRead(chatId) {
  await supabase
    .from('chat_members')
    .update({ unread_count: 0 })
    .eq('chat_id', chatId)
    .eq('user_id', state.user.id);
  const chat = state.chats.find(c => c.id === chatId);
  if (chat) chat.unread_count = 0;
  emit('chats', state.chats);
}

// ---------- Load messages ----------
let currentMessages = [];
export function getMessages() { return currentMessages; }

export async function loadMessages(chatId) {
  const { data } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url),
      reply_to:messages!messages_reply_to_id_fkey(id, body, message_type, sender_id, deleted_for_everyone, attachment_name),
      reactions(id, user_id, emoji)
    `)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(200);

  currentMessages = data || [];
  emit('messages', currentMessages);

  // Mark messages as read (add my user_id to read_by)
  const unread = currentMessages.filter(m =>
    m.sender_id !== state.user.id &&
    !m.deleted_for_everyone &&
    !(m.read_by || []).includes(state.user.id)
  );
  if (unread.length > 0) {
    for (const m of unread) {
      await supabase.from('messages').update({
        read_by: [...(m.read_by || []), state.user.id],
      }).eq('id', m.id);
    }
  }
  return currentMessages;
}

function subscribeMessages(chatId) {
  if (messagesSubscription) {
    supabase.removeChannel(messagesSubscription);
  }
  messagesSubscription = supabase.channel(`chat-${chatId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `chat_id=eq.${chatId}`,
    }, (payload) => {
      currentMessages.push(payload.new);
      emit('messages', currentMessages);
      // If message is from someone else, mark as read
      if (payload.new.sender_id !== state.user.id) {
        supabase.from('messages').update({
          read_by: [...(payload.new.read_by || []), state.user.id],
        }).eq('id', payload.new.id);
      }
      markChatRead(chatId);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `chat_id=eq.${chatId}`,
    }, (payload) => {
      const idx = currentMessages.findIndex(m => m.id === payload.new.id);
      if (idx >= 0) currentMessages[idx] = { ...currentMessages[idx], ...payload.new };
      emit('messages', currentMessages);
    })
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'messages',
      filter: `chat_id=eq.${chatId}`,
    }, (payload) => {
      currentMessages = currentMessages.filter(m => m.id !== payload.old.id);
      emit('messages', currentMessages);
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'reactions',
    }, () => { loadMessages(chatId); })
    .subscribe();
}

function subscribeTyping(chatId) {
  if (typingChannel) supabase.removeChannel(typingChannel);
  typingChannel = supabase.channel(`typing-${chatId}`)
    .on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload?.user_id !== state.user.id) {
        emit('typing', { chatId, user_id: payload.payload.user_id, name: payload.payload.name });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => emit('typing', null), 3000);
      }
    })
    .subscribe();
}

export async function sendTyping(chatId) {
  if (!typingChannel) return;
  await typingChannel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { user_id: state.user.id, name: state.profile.display_name },
  });
}

// ---------- Send message ----------
export async function sendMessage(chatId, body, opts = {}) {
  if (!body?.trim() && !opts.attachment_url) return;
  const msg = {
    chat_id: chatId,
    sender_id: state.user.id,
    body: body?.trim() || '',
    message_type: opts.message_type || 'text',
    attachment_url: opts.attachment_url || '',
    attachment_name: opts.attachment_name || '',
    attachment_size: opts.attachment_size || 0,
    attachment_mime: opts.attachment_mime || '',
    reply_to_id: opts.reply_to_id || null,
    forwarded_from: opts.forwarded_from || null,
  };
  const { data, error } = await supabase.from('messages').insert(msg).select().maybeSingle();
  if (error) { toast('Failed to send message', 'error'); return null; }
  // Update chat updated_at
  await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);
  return data;
}

export async function editMessage(messageId, newBody) {
  const { error } = await supabase.from('messages').update({
    body: newBody.trim(),
    edited_at: new Date().toISOString(),
  }).eq('id', messageId);
  if (error) toast('Failed to edit message', 'error');
}

export async function deleteMessage(messageId, forEveryone = false) {
  if (forEveryone) {
    const { error } = await supabase.from('messages').update({
      body: '',
      deleted_for_everyone: true,
      attachment_url: '',
      message_type: 'text',
    }).eq('id', messageId).eq('sender_id', state.user.id);
    if (error) toast('Failed to delete message', 'error');
  } else {
    // delete for me
    const msg = currentMessages.find(m => m.id === messageId);
    const deletedForMe = [...(msg?.deleted_for_me_by || []), state.user.id];
    const { error } = await supabase.from('messages').update({
      deleted_for_me_by: deletedForMe,
    }).eq('id', messageId);
    if (error) toast('Failed to delete message', 'error');
  }
}

export async function starMessage(messageId) {
  const msg = currentMessages.find(m => m.id === messageId);
  if (!msg) return;
  const starred = toggleArray(msg.starred_by, state.user.id);
  await supabase.from('messages').update({ starred_by: starred }).eq('id', messageId);
}

export async function toggleReaction(messageId, emoji) {
  const msg = currentMessages.find(m => m.id === messageId);
  if (!msg) return;
  const existing = (msg.reactions || []).find(r => r.user_id === state.user.id && r.emoji === emoji);
  if (existing) {
    await supabase.from('reactions').delete().eq('id', existing.id);
  } else {
    await supabase.from('reactions').insert({ message_id: messageId, user_id: state.user.id, emoji });
  }
}

export async function forwardMessage(messageId, toChatIds) {
  const { data: msg } = await supabase.from('messages').select('*').eq('id', messageId).maybeSingle();
  if (!msg) return;
  for (const chatId of toChatIds) {
    await sendMessage(chatId, msg.body, {
      message_type: msg.message_type,
      attachment_url: msg.attachment_url,
      attachment_name: msg.attachment_name,
      attachment_size: msg.attachment_size,
      attachment_mime: msg.attachment_mime,
      forwarded_from: msg.sender_id,
    });
  }
  toast('Message forwarded', 'success');
}

// ---------- Chat management ----------
export async function pinChat(chatId, pinned) {
  await supabase.from('chat_members').update({ pinned }).eq('chat_id', chatId).eq('user_id', state.user.id);
  const chat = state.chats.find(c => c.id === chatId);
  if (chat) chat.pinned = pinned;
  emit('chats', state.chats);
  loadChats();
}

export async function muteChat(chatId, muted) {
  await supabase.from('chat_members').update({ muted }).eq('chat_id', chatId).eq('user_id', state.user.id);
  const chat = state.chats.find(c => c.id === chatId);
  if (chat) chat.muted = muted;
  emit('chats', state.chats);
  toast(muted ? 'Chat muted' : 'Chat unmuted', 'success');
}

export async function archiveChat(chatId, archived) {
  await supabase.from('chat_members').update({ archived }).eq('chat_id', chatId).eq('user_id', state.user.id);
  loadChats();
  toast(archived ? 'Chat archived' : 'Chat unarchived', 'success');
}

export async function clearChatHistory(chatId) {
  const ok = await confirmDialog('Clear chat?', 'All messages will be deleted for you. Other members will still see them.', 'Clear', 'Cancel', true);
  if (!ok) return;
  await supabase.from('messages').delete().eq('chat_id', chatId).eq('sender_id', state.user.id);
  // For other messages, add to deleted_for_me_by
  const { data: msgs } = await supabase.from('messages').select('id, deleted_for_me_by').eq('chat_id', chatId);
  if (msgs) {
    for (const m of msgs) {
      if (!(m.deleted_for_me_by || []).includes(state.user.id)) {
        await supabase.from('messages').update({
          deleted_for_me_by: [...(m.deleted_for_me_by || []), state.user.id],
        }).eq('id', m.id);
      }
    }
  }
  loadMessages(chatId);
  toast('Chat cleared', 'success');
}

export async function deleteChat(chatId) {
  const ok = await confirmDialog('Delete chat?', 'This will remove the chat from your list. Messages will be deleted for you only.', 'Delete', 'Cancel', true);
  if (!ok) return;
  await supabase.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', state.user.id);
  setState({ activeChatId: null });
  loadChats();
  toast('Chat deleted', 'success');
}

// ---------- Search messages ----------
export async function searchMessages(query, chatId = null) {
  let q = supabase.from('messages').select(`
    id, body, created_at, message_type,
    chats!inner(id, name, type, chat_members!inner(user_id, profiles!chat_members_user_id_fkey(username, display_name, avatar_url)))
  `).ilike('body', `%${query}%`);
  if (chatId) q = q.eq('chat_id', chatId);
  const { data } = await q.limit(50);
  return data || [];
}
