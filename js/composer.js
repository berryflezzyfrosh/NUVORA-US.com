// js/composer.js
import { supabase } from './lib/supabase.js';
import { state, emit } from './lib/state.js';
import { $, el, toast, escapeHtml, formatDuration, uploadFile, formatFileSize, getMediaType } from './lib/utils.js';
import { Icon } from './lib/icons.js';
import { sendMessage, sendTyping } from './chat.js';
import { getReplyTo, clearReplyTo } from './lib/replyState.js';

const EMOJI_CATEGORIES = {
  'Smileys': '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔'.split(' '),
  'Gestures': '👋 🤚 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🦾 👏 🙏'.split(' '),
  'Hearts': '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟'.split(' '),
  'Animals': '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🐈 🐎 🐄 🐖 🐑 🐐 🦌 🐕 🐩 🐈‍⬛ 🐇'.split(' '),
  'Food': '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞'.split(' '),
  'Activities': '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥅 🏒 🏑 🏏 🥍 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚴 🚵 🤸 🤼 🤺 🤹 🎯 🎳 🎟️ 🎪'.split(' '),
  'Travel': '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🚚 🚛 🚜 🛵 🏍️ 🛺 🚲 🛴 🛹 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇'.split(' '),
  'Objects': '⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 🕹️ 🗜️ 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ ⏱️ ⏲️ ⏰ 🕰️'.split(' '),
  'Symbols': '✅ ❌ ❓ ❗ ⚠️ 🔱 ⭐ 🌟 ✨ 💫 ⭐️ 🔥 💩 🎉 🎊 🎁 🎀 🎗️ 🏳️ 🏴 🚩 🏁'.split(' '),
};

export function renderComposer(container, chatId) {
  container.innerHTML = `
    <div class="composer">
      <button class="btn-icon" id="emoji-btn" title="Emoji">${Icon.smile}</button>
      <button class="btn-icon" id="attach-btn" title="Attach">${Icon.paperclip}</button>
      <div class="composer-input-wrap">
        <textarea class="composer-input" id="msg-input" placeholder="Type a message..." rows="1"></textarea>
      </div>
      <button class="composer-send" id="send-btn">${Icon.send}</button>
    </div>
  `;

  const input = $('#msg-input');
  const sendBtn = $('#send-btn');
  let isRecording = false;
  let mediaRecorder = null;
  let audioChunks = [];

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    // Show mic when empty, send when typing
    if (input.value.trim()) {
      sendBtn.innerHTML = Icon.send;
      sendBtn.classList.remove('recording');
    } else {
      sendBtn.innerHTML = Icon.mic;
    }
    // Typing indicator
    sendTyping(chatId);
  });

  // Enter to send (if enabled in settings)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && (state.settings?.enter_to_send !== false)) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener('click', () => {
    if (input.value.trim()) {
      handleSend();
    } else {
      // Start voice recording
      toggleVoiceRecording();
    }
  });

  async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    const reply = getReplyTo();
    input.value = '';
    input.style.height = 'auto';
    sendBtn.innerHTML = Icon.mic;
    await sendMessage(chatId, text, { reply_to_id: reply?.id || null });
    clearReplyTo();
    // remove reply bar
    $('#reply-bar-container')?.children.length > 0 && clearReplyTo();
  }

  // Emoji picker
  $('#emoji-btn').addEventListener('click', () => {
    const existing = $('.emoji-picker');
    if (existing) { existing.remove(); return; }
    renderEmojiPicker(container, chatId, input);
  });

  // Attachment
  $('#attach-btn').addEventListener('click', () => {
    renderAttachmentMenu(container, chatId);
  });

  // Voice recording
  async function toggleVoiceRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.addEventListener('dataavailable', (e) => audioChunks.push(e.data));
      mediaRecorder.addEventListener('stop', async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const duration = Math.round((Date.now() - recordStart) / 1000);
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        const path = `${state.user.id}/voice-${Date.now()}.webm`;
        try {
          const url = await uploadFile('voice', file, path);
          await sendMessage(chatId, '', {
            message_type: 'voice',
            attachment_url: url,
            attachment_name: String(duration),
            attachment_size: blob.size,
            attachment_mime: 'audio/webm',
            reply_to_id: getReplyTo()?.id || null,
          });
          clearReplyTo();
        } catch (e) {
          toast('Failed to send voice message', 'error');
        }
        stream.getTracks().forEach(t => t.stop());
      });
      mediaRecorder.start();
      isRecording = true;
      recordStart = Date.now();
      sendBtn.classList.add('recording');
      sendBtn.innerHTML = Icon.stop;
      showRecordingUI(true);
    } catch (e) {
      toast('Microphone access denied', 'error');
    }
  }

  let recordStart = 0;
  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecording = false;
    sendBtn.classList.remove('recording');
    sendBtn.innerHTML = Icon.mic;
    showRecordingUI(false);
  }

  function showRecordingUI(show) {
    let bar = $('#recording-bar');
    if (show) {
      if (!bar) {
        bar = el('div', { class: 'recording-bar', id: 'recording-bar' });
        bar.innerHTML = `<div class="recording-dot"></div><span class="recording-time" id="rec-time">0:00</span><span style="flex:1;"></span><span style="font-size:13px;color:var(--text-muted);">Recording... tap stop to send</span>`;
        container.querySelector('.composer').prepend(bar);
        const timer = setInterval(() => {
          if (!isRecording) { clearInterval(timer); return; }
          const dur = Math.round((Date.now() - recordStart) / 1000);
          const tEl = $('#rec-time');
          if (tEl) tEl.textContent = formatDuration(dur);
        }, 500);
      }
    } else {
      bar?.remove();
    }
  }

  // Initial state
  sendBtn.innerHTML = Icon.mic;
}

export function renderEmojiPicker(container, chatId, input) {
  const picker = el('div', { class: 'emoji-picker' });
  let currentCat = 'Smileys';
  function renderGrid() {
    const emojis = EMOJI_CATEGORIES[currentCat] || [];
    const grid = el('div', { class: 'emoji-grid' });
    emojis.forEach(e => {
      const cell = el('div', { class: 'emoji-cell', text: e });
      cell.addEventListener('click', () => {
        input.value += e;
        input.dispatchEvent(new Event('input'));
        input.focus();
      });
      grid.append(cell);
    });
    return grid;
  }
  function renderHeader() {
    const header = el('div', { class: 'emoji-picker-header' });
    Object.keys(EMOJI_CATEGORIES).forEach(cat => {
      const firstEmoji = EMOJI_CATEGORIES[cat][0];
      const c = el('div', { class: `emoji-cat ${cat === currentCat ? 'active' : ''}`, text: firstEmoji });
      c.addEventListener('click', () => {
        currentCat = cat;
        header.querySelectorAll('.emoji-cat').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        const newGrid = renderGrid();
        picker.querySelector('.emoji-grid')?.replaceWith(newGrid);
      });
      header.append(c);
    });
    return header;
  }
  picker.append(renderHeader());
  picker.append(renderGrid());
  container.querySelector('.composer')?.before(picker) || container.append(picker);
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!picker.contains(e.target) && e.target.id !== 'emoji-btn') {
        picker.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 100);
}

export function renderAttachmentMenu(container, chatId) {
  const menu = el('div', { class: 'context-menu', style: 'bottom:70px;left:12px;' });
  menu.innerHTML = `
    <label class="context-menu-item" style="cursor:pointer;">${Icon.image}<span>Photo / Video</span><input type="file" accept="image/*,video/*" style="display:none;" id="attach-media" /></label>
    <label class="context-menu-item" style="cursor:pointer;">${Icon.file}<span>Document</span><input type="file" style="display:none;" id="attach-file" /></label>
    <label class="context-menu-item" style="cursor:pointer;">${Icon.camera}<span>Camera</span><input type="file" accept="image/*" capture="environment" style="display:none;" id="attach-camera" /></label>
  `;
  container.querySelector('.composer')?.before(menu) || container.append(menu);

  async function handleFile(file) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast('File must be under 50MB', 'error'); return; }
    const mediaType = getMediaType(file.type);
    const bucket = mediaType === 'image' || mediaType === 'video' ? 'attachments' : 'attachments';
    const path = `${state.user.id}/${Date.now()}-${file.name}`;
    toast('Uploading...', 'info', 2000);
    try {
      const url = await uploadFile(bucket, file, path);
      await sendMessage(chatId, '', {
        message_type: mediaType,
        attachment_url: url,
        attachment_name: file.name,
        attachment_size: file.size,
        attachment_mime: file.type,
        reply_to_id: getReplyTo()?.id || null,
      });
      clearReplyTo();
    } catch (e) {
      toast('Failed to upload file', 'error');
    }
  }

  $('#attach-media').addEventListener('change', (e) => handleFile(e.target.files[0]));
  $('#attach-file').addEventListener('change', (e) => handleFile(e.target.files[0]));
  $('#attach-camera').addEventListener('change', (e) => handleFile(e.target.files[0]));

  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!menu.contains(e.target) && e.target.id !== 'attach-btn') {
        menu.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 100);
}
