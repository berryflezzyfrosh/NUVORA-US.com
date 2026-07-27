// js/status.js
import { supabase } from './lib/supabase.js';
import { state, emit, subscribe } from './lib/state.js';
import { $, el, toast, escapeHtml, avatarHTML, formatTime, formatDate, showModal, closeModal, confirmDialog, uploadFile, debounce } from './lib/utils.js';
import { Icon } from './lib/icons.js';

export async function loadStatuses() {
  if (!state.user) return;
  // Get statuses from last 24h
  const { data } = await supabase
    .from('statuses')
    .select(`
      *,
      user:profiles!statuses_user_id_fkey(id, username, display_name, avatar_url),
      status_views(status_id, user_id, viewed_at)
    `)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  state.statusUpdates = data || [];
  emit('statuses', state.statusUpdates);
  return data;
}

export function renderStatusList(area) {
  loadStatuses();
  const statuses = state.statusUpdates || [];
  // Group by user
  const byUser = {};
  for (const s of statuses) {
    if (!byUser[s.user_id]) byUser[s.user_id] = { user: s.user, statuses: [], allViewed: true };
    byUser[s.user_id].statuses.push(s);
    const viewed = s.status_views?.some(v => v.user_id === state.user.id);
    if (!viewed) byUser[s.user_id].allViewed = false;
  }
  const users = Object.values(byUser).sort((a, b) => new Date(b.statuses[0].created_at) - new Date(a.statuses[0].created_at));

  let html = `
    <div class="status-list-item" id="my-status-btn">
      <div class="status-ring ${state.statusUpdates?.some(s => s.user_id === state.user.id) ? 'seen' : ''}">
        ${avatarHTML(state.profile, 'md')}
      </div>
      <div class="member-info">
        <div class="member-name">My Status</div>
        <div style="font-size:13px;color:var(--text-muted);">${state.statusUpdates?.some(s => s.user_id === state.user.id) ? 'Tap to view' : 'Tap to add status'}</div>
      </div>
    </div>
  `;

  if (users.filter(u => u.user.id !== state.user.id).length > 0) {
    html += `<div class="detail-section-title" style="padding:8px 16px;">Recent Updates</div>`;
  }
  for (const u of users) {
    if (u.user.id === state.user.id) continue;
    html += `
      <div class="status-list-item" data-user-id="${u.user.id}">
        <div class="status-ring ${u.allViewed ? 'seen' : ''}">
          ${avatarHTML(u.user, 'md')}
        </div>
        <div class="member-info">
          <div class="member-name">${escapeHtml(u.user.display_name)}</div>
          <div style="font-size:13px;color:var(--text-muted);">${formatDate(u.statuses[0].created_at)}</div>
        </div>
      </div>
    `;
  }

  area.innerHTML = html;
  $('#my-status-btn').addEventListener('click', () => {
    const myStatuses = state.statusUpdates?.filter(s => s.user_id === state.user.id) || [];
    if (myStatuses.length > 0) {
      viewStatuses(myStatuses);
    } else {
      showPostStatusModal();
    }
  });
  area.querySelectorAll('.status-list-item[data-user-id]').forEach(item => {
    item.addEventListener('click', () => {
      const userId = item.dataset.userId;
      const userStatuses = state.statusUpdates?.filter(s => s.user_id === userId) || [];
      if (userStatuses.length > 0) viewStatuses(userStatuses);
    });
  });
}

export function renderStatusView(main) {
  main.innerHTML = `
    <div class="main-header">
      <div class="main-header-title">Status</div>
      <button class="btn-icon" id="post-status-btn">${Icon.plus}</button>
    </div>
    <div class="main-content" style="padding:20px;text-align:center;">
      <div style="max-width:400px;margin:0 auto;">
        ${avatarHTML(state.profile, 'xl')}
        <h2 style="margin:16px 0 8px;">Share your moment</h2>
        <p style="color:var(--text-muted);margin-bottom:24px;">Post a text, photo, or video status that disappears after 24 hours.</p>
        <button class="btn btn-primary btn-block" id="add-status-btn">${Icon.plus} Add Status</button>
        <div style="margin-top:24px;text-align:left;">
          <div class="detail-section-title">Privacy</div>
          <p style="color:var(--text-muted);font-size:14px;">Your status privacy is set to "${state.settings?.status_visibility || 'contacts'}". Change it in Settings → Privacy.</p>
        </div>
      </div>
    </div>
  `;
  $('#post-status-btn').addEventListener('click', showPostStatusModal);
  $('#add-status-btn').addEventListener('click', showPostStatusModal);
}

function showPostStatusModal() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'New Status' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Text Status' }),
        el('textarea', { class: 'textarea', id: 'status-text', placeholder: "What's on your mind?", maxlength: '200' }),
      ]),
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'Background Color' }),
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;', id: 'color-picker' },
          ['#0ea5e9', '#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#10b981', '#0f172a'].map(c =>
            el('div', { style: `width:32px;height:32px;border-radius:50%;background:${c};cursor:pointer;border:2px solid transparent;`, class: 'color-swatch', 'data-color': c })
          )
        ),
      ]),
      el('div', { style: 'display:flex;gap:8px;' }, [
        el('label', { class: 'btn btn-ghost btn-block', style: 'cursor:pointer;justify-content:center;', html: `${Icon.image} <span>Photo</span><input type="file" accept="image/*" id="status-image" style="display:none;" />` }),
        el('label', { class: 'btn btn-ghost btn-block', style: 'cursor:pointer;justify-content:center;', html: `${Icon.video} <span>Video</span><input type="file" accept="video/*" id="status-video" style="display:none;" />` }),
      ]),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => closeModal(content.closest('.modal-overlay')) }, 'Cancel'),
      el('button', { class: 'btn btn-primary', id: 'post-status-btn', onclick: async () => {
        const text = $('#status-text').value.trim();
        const color = content.querySelector('.color-swatch.selected')?.dataset.color || '#0ea5e9';
        if (text) {
          await postStatus({ content_type: 'text', body: text, background_color: color });
          closeModal(content.closest('.modal-overlay'));
        } else {
          toast('Add text or media', 'error');
        }
      } }, 'Post'),
    ]),
  ]);
  showModal(content);

  // Color picker
  content.querySelectorAll('.color-swatch').forEach((sw, i) => {
    if (i === 0) sw.style.borderColor = 'var(--text)';
    sw.addEventListener('click', () => {
      content.querySelectorAll('.color-swatch').forEach(s => s.style.borderColor = 'transparent');
      sw.style.borderColor = 'var(--text)';
    });
  });

  $('#status-image').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('Image must be under 20MB', 'error'); return; }
    const path = `${state.user.id}/status-${Date.now()}.${file.name.split('.').pop()}`;
    try {
      const url = await uploadFile('statuses', file, path);
      await postStatus({ content_type: 'image', media_url: url, caption: $('#status-text').value.trim() });
      closeModal(content.closest('.modal-overlay'));
    } catch (err) {
      toast('Failed to upload', 'error');
    }
  });

  $('#status-video').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast('Video must be under 50MB', 'error'); return; }
    const path = `${state.user.id}/status-${Date.now()}.${file.name.split('.').pop()}`;
    try {
      const url = await uploadFile('statuses', file, path);
      await postStatus({ content_type: 'video', media_url: url, caption: $('#status-text').value.trim() });
      closeModal(content.closest('.modal-overlay'));
    } catch (err) {
      toast('Failed to upload', 'error');
    }
  });
}

export async function postStatus(data) {
  const privacy = state.settings?.status_visibility || 'contacts';
  const { error } = await supabase.from('statuses').insert({
    user_id: state.user.id,
    content_type: data.content_type,
    body: data.body || '',
    media_url: data.media_url || '',
    background_color: data.background_color || '',
    caption: data.caption || '',
    privacy,
  });
  if (error) toast('Failed to post status', 'error');
  else toast('Status posted', 'success');
  loadStatuses();
}

function viewStatuses(statuses) {
  const viewer = el('div', { class: 'status-viewer' });
  let idx = 0;

  function renderCurrent() {
    const s = statuses[idx];
    if (!s) { viewer.remove(); return; }
    // Record view
    if (s.user_id !== state.user.id) {
      supabase.from('status_views').upsert({ status_id: s.id, user_id: state.user.id }).then();
    }

    viewer.innerHTML = `
      <div class="status-progress">
        ${statuses.map((_, i) => `
          <div class="status-progress-bar ${i < idx ? 'done' : i === idx ? 'active' : ''}">
            <div class="fill"></div>
          </div>
        `).join('')}
      </div>
      <div style="position:absolute;top:24px;left:16px;right:16px;display:flex;align-items:center;gap:10px;z-index:2;color:#fff;">
        ${avatarHTML(s.user, 'sm')}
        <div>
          <div style="font-weight:600;">${escapeHtml(s.user?.display_name || 'Unknown')}</div>
          <div style="font-size:12px;opacity:0.7;">${formatDate(s.created_at)}</div>
        </div>
        <button class="btn-icon" style="color:#fff;margin-left:auto;" id="close-status">${Icon.x}</button>
      </div>
      <div class="status-content" id="status-content">
        ${renderStatusContent(s)}
      </div>
      ${s.user_id === state.user.id ? `
        <div style="position:absolute;bottom:24px;left:0;right:0;text-align:center;z-index:2;">
          <button class="btn btn-ghost" style="color:#fff;background:rgba(0,0,0,0.4);" id="delete-status">${Icon.trash} Delete</button>
          <button class="btn btn-ghost" style="color:#fff;background:rgba(0,0,0,0.4);" id="view-viewers">${Icon.eye} ${s.status_views?.length || 0} views</button>
        </div>
      ` : `
        <div style="position:absolute;bottom:24px;left:16px;right:16px;z-index:2;">
          <input class="input" id="status-reply-input" placeholder="Reply..." style="background:rgba(255,255,255,0.15);color:#fff;border:none;" />
        </div>
      `}
    `;

    $('#close-status').addEventListener('click', () => viewer.remove());
    $('#delete-status')?.addEventListener('click', async () => {
      const ok = await confirmDialog('Delete status?', 'This status will be removed.', 'Delete', 'Cancel', true);
      if (ok) {
        await supabase.from('statuses').delete().eq('id', s.id);
        toast('Status deleted', 'success');
        loadStatuses();
        viewer.remove();
      }
    });
    $('#view-viewers')?.addEventListener('click', () => showStatusViewers(s));
    $('#status-reply-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = e.target.value.trim();
        if (text) {
          // Reply as a direct message
          import('./profile.js').then(m => m.createDirectChat(s.user_id).then(chatId => {
            import('./chat.js').then(c => c.sendMessage(chatId, text));
            toast('Reply sent', 'success');
          }));
        }
        e.target.value = '';
      }
    });

    // Auto-advance after 5s
    clearTimeout(window._statusTimer);
    window._statusTimer = setTimeout(() => {
      idx++;
      if (idx < statuses.length) renderCurrent();
      else viewer.remove();
    }, 5000);
  }

  function renderStatusContent(s) {
    if (s.content_type === 'text') {
      return `<div class="status-text-display" style="background:${s.background_color || '#0ea5e9'};min-height:60vh;display:flex;align-items:center;justify-content:center;border-radius:12px;">${escapeHtml(s.body)}</div>`;
    } else if (s.content_type === 'image') {
      return `<img src="${escapeHtml(s.media_url)}" style="max-height:80vh;border-radius:12px;" />${s.caption ? `<div style="color:#fff;text-align:center;margin-top:12px;">${escapeHtml(s.caption)}</div>` : ''}`;
    } else if (s.content_type === 'video') {
      return `<video src="${escapeHtml(s.media_url)}" autoplay style="max-height:80vh;border-radius:12px;"></video>${s.caption ? `<div style="color:#fff;text-align:center;margin-top:12px;">${escapeHtml(s.caption)}</div>` : ''}`;
    }
    return '';
  }

  document.body.append(viewer);
  renderCurrent();

  // Click to advance
  viewer.addEventListener('click', (e) => {
    if (e.target.id === 'status-content' || e.target.closest('.status-content')) {
      clearTimeout(window._statusTimer);
      idx++;
      if (idx < statuses.length) renderCurrent();
      else viewer.remove();
    }
  });
}

function showStatusViewers(status) {
  const viewers = status.status_views || [];
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Viewed by' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, viewers.length === 0
      ? '<p style="text-align:center;color:var(--text-muted);">No views yet</p>'
      : viewers.map(v => `<div class="member-item">Viewed</div>`).join('')
    ),
  ]);
  showModal(content);
}
