// js/ai.js
import { supabase } from './lib/supabase.js';
import { state, emit } from './lib/state.js';
import { $, $$, el, toast, escapeHtml, avatarHTML, formatTime } from './lib/utils.js';
import { Icon } from './lib/icons.js';

const NUVO_SYSTEM_PROMPT = `You are NUVO, the built-in AI assistant inside NUVORA, a global real-time messaging app. You are friendly, helpful, and concise. You help users with:
- Answering questions and explaining concepts
- Writing assistance (composing, rewriting, improving messages)
- Summarizing text
- Translating text between languages
- Brainstorming ideas
- Generating suggestions and helping compose replies
- General AI assistance

Keep responses clear and natural. When helping rewrite or compose messages, provide the rewritten text directly. You are an AI assistant — never pretend to be a human user.`;

export async function renderNuvoView(main) {
  main.innerHTML = `
    <div class="chat-view" style="background:var(--bg-chat);">
      <div class="main-header">
        <button class="btn-icon" id="nuvo-back">${Icon.arrowLeft}</button>
        <div class="main-header-info">
          <div class="nuvo-avatar avatar-sm" style="width:36px;height:36px;font-size:14px;">N</div>
          <div>
            <div class="main-header-title">NUVO</div>
            <div class="main-header-sub">AI Assistant</div>
          </div>
        </div>
        <button class="btn-icon" id="nuvo-clear" title="Clear chat">${Icon.trash}</button>
      </div>
      <div class="chat-messages" id="nuvo-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;"></div>
      <div id="nuvo-suggestions" style="padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--border);background:var(--bg-header);"></div>
      <div class="composer">
        <div class="composer-input-wrap">
          <textarea class="composer-input" id="nuvo-input" placeholder="Ask NUVO anything..." rows="1"></textarea>
        </div>
        <button class="composer-send" id="nuvo-send">${Icon.send}</button>
      </div>
    </div>
  `;

  $('#nuvo-back').addEventListener('click', () => {
    import('./ui.js').then(m => {
      state.activeView = 'chats';
      m.renderListArea();
      m.renderMainArea();
    });
  });

  $('#nuvo-clear').addEventListener('click', async () => {
    await supabase.from('ai_conversations').delete().eq('user_id', state.user.id);
    loadNuvoMessages();
    toast('Chat cleared', 'success');
  });

  // Suggestions
  const suggestions = [
    'Summarize my last chat',
    'Help me write a reply',
    'Translate to Spanish',
    'Brainstorm ideas',
  ];
  $('#nuvo-suggestions').innerHTML = suggestions.map(s =>
    `<button class="btn btn-sm btn-ghost" data-suggestion="${escapeHtml(s)}">${escapeHtml(s)}</button>`
  ).join('');
  $$('#nuvo-suggestions button').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#nuvo-input').value = btn.dataset.suggestion;
      handleNuvoSend();
    });
  });

  $('#nuvo-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNuvoSend();
    }
  });
  $('#nuvo-send').addEventListener('click', handleNuvoSend);

  await loadNuvoMessages();
}

async function loadNuvoMessages() {
  const container = $('#nuvo-messages');
  if (!container) return;
  const { data } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', state.user.id)
    .order('created_at', { ascending: true })
    .limit(50);

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;text-align:center;color:var(--text-muted);">
        <div class="nuvo-avatar avatar-xl" style="margin-bottom:16px;">N</div>
        <h2 style="margin-bottom:8px;">Hi, I'm NUVO</h2>
        <p style="max-width:320px;">Your AI assistant inside NUVORA. I can help you write messages, translate, summarize, brainstorm, and answer questions.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(m => {
    if (m.role === 'user') {
      return `
        <div class="msg out">
          <div class="msg-bubble">
            <div class="msg-text">${escapeHtml(m.content)}</div>
            <div class="msg-meta"><span>${formatTime(m.created_at)}</span></div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="msg in">
          <div class="nuvo-avatar avatar-sm" style="margin-right:8px;">N</div>
          <div class="msg-bubble nuvo-bubble">
            <div class="msg-text">${escapeHtml(m.content)}</div>
            <div class="msg-meta"><span>${formatTime(m.created_at)}</span></div>
          </div>
        </div>
      `;
    }
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function handleNuvoSend() {
  const input = $('#nuvo-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  // Save user message
  await supabase.from('ai_conversations').insert({
    user_id: state.user.id,
    role: 'user',
    content: text,
  });

  // Show typing indicator
  const container = $('#nuvo-messages');
  const typingEl = el('div', { class: 'msg in', id: 'nuvo-typing' });
  typingEl.innerHTML = `
    <div class="nuvo-avatar avatar-sm" style="margin-right:8px;">N</div>
    <div class="msg-bubble nuvo-bubble">
      <div class="nuvo-typing"><span></span><span></span><span></span></div>
    </div>
  `;
  container.append(typingEl);
  container.scrollTop = container.scrollHeight;

  // Call NUVO edge function
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nuvo-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ message: text }),
    });

    if (!response.ok) throw new Error('Request failed');

    const data = await response.json();

    typingEl.remove();

    if (data.error) {
      toast(data.error, 'error');
      // Show fallback response
      await supabase.from('ai_conversations').insert({
        user_id: state.user.id,
        role: 'assistant',
        content: getFallbackResponse(text),
      });
    } else {
      await supabase.from('ai_conversations').insert({
        user_id: state.user.id,
        role: 'assistant',
        content: data.reply || data.content || 'I could not process that.',
      });
    }
  } catch (e) {
    typingEl.remove();
    // Fallback: provide a helpful local response
    const fallback = getFallbackResponse(text);
    await supabase.from('ai_conversations').insert({
      user_id: state.user.id,
      role: 'assistant',
      content: fallback,
    });
  }

  loadNuvoMessages();
}

function getFallbackResponse(text) {
  const lower = text.toLowerCase();
  if (lower.includes('translate')) {
    return 'I can help with translations! For the best experience, the NUVO AI service should be configured with an API key. Right now I\'m running in offline mode. Please contact the app administrator to enable full AI capabilities.';
  }
  if (lower.includes('summar')) {
    return 'To summarize text, paste it here and I\'ll condense it for you. (Note: Full AI summarization requires the NUVO service to be configured.)';
  }
  if (lower.includes('write') || lower.includes('reply') || lower.includes('compose')) {
    return 'I\'d be happy to help you write a message! Tell me what you want to say and to whom, and I\'ll help you craft it. (Note: Full AI writing assistance requires the NUVO service to be configured with an API key.)';
  }
  return 'Hi! I\'m NUVO, your AI assistant. I can help with writing, translation, summarization, brainstorming, and answering questions. For full AI capabilities, the NUVO service needs to be configured with an API key. In the meantime, feel free to ask me anything and I\'ll do my best to help!';
}
