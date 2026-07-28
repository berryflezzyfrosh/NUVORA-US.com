// js/settings.js
import { supabase } from './lib/supabase.js';
import { state, setState, emit, loadSettings, applyTheme } from './lib/state.js';
import { $, el, toast, escapeHtml, avatarHTML, showModal, closeModal, confirmDialog, formatFileSize, formatDateTime, debounce, logoUrl } from './lib/utils.js';
import { Icon } from './lib/icons.js';
import { searchUsers, showProfileModal, showEditProfileModal } from './profile.js';
import { loadChats } from './chat.js';
import { logout } from './auth.js';

export function renderSettingsView(main, section = 'main') {
  if (section === 'main' || section === 'profile') {
    renderSettingsMain(main);
  } else if (section === 'privacy') {
    renderPrivacySettings(main);
  } else if (section === 'security') {
    renderSecuritySettings(main);
  } else if (section === 'notifications') {
    renderNotificationsSettings(main);
  } else if (section === 'appearance') {
    renderAppearanceSettings(main);
  } else if (section === 'storage') {
    renderStorageView(main);
  } else if (section === 'blocked') {
    renderBlockedView(main);
  } else if (section === 'account') {
    renderAccountSettings(main);
  } else if (section === 'help') {
    renderHelpSettings(main);
  } else if (section === 'about') {
    renderAboutSettings(main);
  }
}

function renderSettingsMain(main) {
  main.innerHTML = `
    <div class="main-header">
      <div class="main-header-title">Settings</div>
    </div>
    <div class="main-content" style="padding:16px;overflow-y:auto;">
      <div class="settings-section" id="profile-section" style="cursor:pointer;">
        <div class="settings-item">
          ${avatarHTML(state.profile, 'md')}
          <div class="settings-item-body">
            <div class="settings-item-title">${escapeHtml(state.profile?.display_name || '')}</div>
            <div class="settings-item-sub">${escapeHtml(state.profile?.bio || 'No bio')}</div>
          </div>
          ${Icon.chevronRight}
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-item" data-section="account">
          <div class="settings-item-icon" style="background:rgba(59,130,246,0.15);color:var(--info);">${Icon.key}</div>
          <div class="settings-item-body"><div class="settings-item-title">Account</div><div class="settings-item-sub">${escapeHtml(state.user?.email || '')}</div></div>
          ${Icon.chevronRight}
        </div>
        <div class="settings-item" data-section="privacy">
          <div class="settings-item-icon" style="background:rgba(245,158,11,0.15);color:var(--warning);">${Icon.lock}</div>
          <div class="settings-item-body"><div class="settings-item-title">Privacy</div></div>
          ${Icon.chevronRight}
        </div>
        <div class="settings-item" data-section="security">
          <div class="settings-item-icon" style="background:rgba(34,197,94,0.15);color:var(--success);">${Icon.shield}</div>
          <div class="settings-item-body"><div class="settings-item-title">Security</div></div>
          ${Icon.chevronRight}
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-item" data-section="notifications">
          <div class="settings-item-icon" style="background:rgba(239,68,68,0.15);color:var(--error);">${Icon.bell}</div>
          <div class="settings-item-body"><div class="settings-item-title">Notifications</div></div>
          ${Icon.chevronRight}
        </div>
        <div class="settings-item" data-section="appearance">
          <div class="settings-item-icon" style="background:rgba(139,92,246,0.15);color:var(--nuvo);">${Icon.palette}</div>
          <div class="settings-item-body"><div class="settings-item-title">Appearance</div><div class="settings-item-sub">${state.settings?.theme || 'system'}</div></div>
          ${Icon.chevronRight}
        </div>
        <div class="settings-item" data-section="storage">
          <div class="settings-item-icon" style="background:rgba(20,184,166,0.15);color:var(--accent);">${Icon.database}</div>
          <div class="settings-item-body"><div class="settings-item-title">Storage & Data</div></div>
          ${Icon.chevronRight}
        </div>
        <div class="settings-item" data-section="blocked">
          <div class="settings-item-icon" style="background:rgba(239,68,68,0.15);color:var(--error);">${Icon.block}</div>
          <div class="settings-item-body"><div class="settings-item-title">Blocked</div></div>
          ${Icon.chevronRight}
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-item" data-section="help">
          <div class="settings-item-icon" style="background:var(--bg-active);color:var(--text-secondary);">${Icon.help}</div>
          <div class="settings-item-body"><div class="settings-item-title">Help</div></div>
          ${Icon.chevronRight}
        </div>
        <div class="settings-item" data-section="about">
          <div class="settings-item-icon" style="background:var(--bg-active);color:var(--text-secondary);">${Icon.info}</div>
          <div class="settings-item-body"><div class="settings-item-title">About NUVORA</div></div>
          ${Icon.chevronRight}
        </div>
      </div>
      <div style="padding:16px;">
        <button class="btn btn-danger btn-block" id="settings-logout-btn">${Icon.logout} Log Out</button>
      </div>
    </div>
  `;
  $('#profile-section').addEventListener('click', showEditProfileModal);
  main.querySelectorAll('[data-section]').forEach(item => {
    item.addEventListener('click', () => renderSettingsView(main, item.dataset.section));
  });
  $('#settings-logout-btn').addEventListener('click', logout);
}

function renderPrivacySettings(main) {
  const s = state.settings || {};
  main.innerHTML = `
    <div class="main-header">
      <button class="btn-icon" id="settings-back">${Icon.arrowLeft}</button>
      <div class="main-header-title">Privacy</div>
    </div>
    <div class="main-content" style="padding:16px;overflow-y:auto;">
      <div class="settings-section">
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">Last Seen & Online</div>
            <div class="settings-item-sub">Who can see your last seen</div>
          </div>
          <select class="select" id="last-seen-visibility" style="width:auto;">
            <option value="everyone" ${s.last_seen_visibility === 'everyone' ? 'selected' : ''}>Everyone</option>
            <option value="contacts" ${s.last_seen_visibility === 'contacts' ? 'selected' : ''}>Contacts</option>
            <option value="nobody" ${s.last_seen_visibility === 'nobody' ? 'selected' : ''}>Nobody</option>
          </select>
        </div>
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">Profile Photo</div>
            <div class="settings-item-sub">Who can see your photo</div>
          </div>
          <select class="select" id="profile-photo-visibility" style="width:auto;">
            <option value="everyone" ${s.profile_photo_visibility === 'everyone' ? 'selected' : ''}>Everyone</option>
            <option value="contacts" ${s.profile_photo_visibility === 'contacts' ? 'selected' : ''}>Contacts</option>
            <option value="nobody" ${s.profile_photo_visibility === 'nobody' ? 'selected' : ''}>Nobody</option>
          </select>
        </div>
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">Status</div>
            <div class="settings-item-sub">Who can see your status</div>
          </div>
          <select class="select" id="status-visibility" style="width:auto;">
            <option value="everyone" ${s.status_visibility === 'everyone' ? 'selected' : ''}>Everyone</option>
            <option value="contacts" ${s.status_visibility === 'contacts' ? 'selected' : ''}>Contacts</option>
            <option value="nobody" ${s.status_visibility === 'nobody' ? 'selected' : ''}>Nobody</option>
          </select>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">Read Receipts</div>
            <div class="settings-item-sub">Show blue ticks when you read messages</div>
          </div>
          <label class="toggle"><input type="checkbox" id="read-receipts" ${s.read_receipts ? 'checked' : ''}><span class="toggle-slider"></span></label>
        </div>
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">Typing Indicators</div>
            <div class="settings-item-sub">Show when you're typing</div>
          </div>
          <label class="toggle"><input type="checkbox" id="typing-indicators" ${s.typing_indicators ? 'checked' : ''}><span class="toggle-slider"></span></label>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-item" id="blocked-contacts-link">
          <div class="settings-item-icon" style="background:rgba(239,68,68,0.15);color:var(--error);">${Icon.block}</div>
          <div class="settings-item-body"><div class="settings-item-title">Blocked Contacts</div></div>
          ${Icon.chevronRight}
        </div>
      </div>
    </div>
  `;
  $('#settings-back').addEventListener('click', () => renderSettingsView(main, 'main'));
  $('#blocked-contacts-link').addEventListener('click', () => renderBlockedView(main));

  const updateSetting = async (key, value) => {
    await supabase.from('user_settings').update({ [key]: value, updated_at: new Date().toISOString() }).eq('user_id', state.user.id);
    if (state.settings) state.settings[key] = value;
    emit('settings', state.settings);
    toast('Privacy updated', 'success');
  };

  $('#last-seen-visibility').addEventListener('change', (e) => updateSetting('last_seen_visibility', e.target.value));
  $('#profile-photo-visibility').addEventListener('change', (e) => updateSetting('profile_photo_visibility', e.target.value));
  $('#status-visibility').addEventListener('change', (e) => updateSetting('status_visibility', e.target.value));
  $('#read-receipts').addEventListener('change', (e) => updateSetting('read_receipts', e.target.checked));
  $('#typing-indicators').addEventListener('change', (e) => updateSetting('typing_indicators', e.target.checked));
}

function renderSecuritySettings(main) {
  main.innerHTML = `
    <div class="main-header">
      <button class="btn-icon" id="settings-back">${Icon.arrowLeft}</button>
      <div class="main-header-title">Security</div>
    </div>
    <div class="main-content" style="padding:16px;overflow-y:auto;">
      <div class="settings-section">
        <div class="settings-item" id="change-password-btn">
          <div class="settings-item-icon" style="background:rgba(59,130,246,0.15);color:var(--info);">${Icon.key}</div>
          <div class="settings-item-body"><div class="settings-item-title">Change Password</div></div>
          ${Icon.chevronRight}
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-item">
          <div class="settings-item-icon" style="background:rgba(34,197,94,0.15);color:var(--success);">${Icon.shield}</div>
          <div class="settings-item-body">
            <div class="settings-item-title">Security Status</div>
            <div class="settings-item-sub">Your account is protected with email & password authentication</div>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-item">
          <div class="settings-item-icon" style="background:rgba(245,158,11,0.15);color:var(--warning);">${Icon.mail}</div>
          <div class="settings-item-body">
            <div class="settings-item-title">Email</div>
            <div class="settings-item-sub">${escapeHtml(state.user?.email || '')}</div>
          </div>
        </div>
      </div>
    </div>
  `;
  $('#settings-back').addEventListener('click', () => renderSettingsView(main, 'main'));
  $('#change-password-btn').addEventListener('click', showChangePasswordModal);
}

function showChangePasswordModal() {
  const content = el('div', {}, [
    el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-title', text: 'Change Password' }),
      el('button', { class: 'btn-icon', onclick: () => closeModal(content.closest('.modal-overlay')), html: Icon.x }),
    ]),
    el('div', { class: 'modal-body' }, [
      el('div', { class: 'input-group mb-4' }, [
        el('label', { class: 'input-label', text: 'New Password' }),
        el('input', { class: 'input', type: 'password', id: 'new-pw', placeholder: 'At least 6 characters', minlength: '6' }),
      ]),
      el('div', { class: 'input-group' }, [
        el('label', { class: 'input-label', text: 'Confirm Password' }),
        el('input', { class: 'input', type: 'password', id: 'confirm-pw', placeholder: 'Re-enter password' }),
      ]),
    ]),
    el('div', { class: 'modal-footer' }, [
      el('button', { class: 'btn btn-ghost', onclick: () => closeModal(content.closest('.modal-overlay')) }, 'Cancel'),
      el('button', { class: 'btn btn-primary', onclick: async () => {
        const pw = $('#new-pw').value;
        const confirm = $('#confirm-pw').value;
        if (pw.length < 6) { toast('Password too short', 'error'); return; }
        if (pw !== confirm) { toast('Passwords do not match', 'error'); return; }
        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) { toast(error.message, 'error'); return; }
        toast('Password updated', 'success');
        closeModal(content.closest('.modal-overlay'));
      } }, 'Update'),
    ]),
  ]);
  showModal(content);
}

function renderNotificationsSettings(main) {
  const s = state.settings || {};
  main.innerHTML = `
    <div class="main-header">
      <button class="btn-icon" id="settings-back">${Icon.arrowLeft}</button>
      <div class="main-header-title">Notifications</div>
    </div>
    <div class="main-content" style="padding:16px;overflow-y:auto;">
      <div class="settings-section">
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">Message Notifications</div>
            <div class="settings-item-sub">Show notifications for new messages</div>
          </div>
          <label class="toggle"><input type="checkbox" id="notif-messages" ${s.notification_messages ? 'checked' : ''}><span class="toggle-slider"></span></label>
        </div>
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">Group Notifications</div>
            <div class="settings-item-sub">Show notifications for group messages</div>
          </div>
          <label class="toggle"><input type="checkbox" id="notif-groups" ${s.notification_groups ? 'checked' : ''}><span class="toggle-slider"></span></label>
        </div>
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">Call Notifications</div>
            <div class="settings-item-sub">Show notifications for incoming calls</div>
          </div>
          <label class="toggle"><input type="checkbox" id="notif-calls" ${s.notification_calls ? 'checked' : ''}><span class="toggle-slider"></span></label>
        </div>
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">Status Notifications</div>
            <div class="settings-item-sub">Show notifications for new status updates</div>
          </div>
          <label class="toggle"><input type="checkbox" id="notif-statuses" ${s.notification_statuses ? 'checked' : ''}><span class="toggle-slider"></span></label>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-item" id="enable-browser-notif">
          <div class="settings-item-icon" style="background:rgba(239,68,68,0.15);color:var(--error);">${Icon.bell}</div>
          <div class="settings-item-body">
            <div class="settings-item-title">Browser Notifications</div>
            <div class="settings-item-sub">Enable desktop notifications</div>
          </div>
          ${Icon.chevronRight}
        </div>
      </div>
    </div>
  `;
  $('#settings-back').addEventListener('click', () => renderSettingsView(main, 'main'));

  const updateSetting = async (key, value) => {
    await supabase.from('user_settings').update({ [key]: value, updated_at: new Date().toISOString() }).eq('user_id', state.user.id);
    if (state.settings) state.settings[key] = value;
    toast('Notification settings updated', 'success');
  };
  $('#notif-messages').addEventListener('change', (e) => updateSetting('notification_messages', e.target.checked));
  $('#notif-groups').addEventListener('change', (e) => updateSetting('notification_groups', e.target.checked));
  $('#notif-calls').addEventListener('change', (e) => updateSetting('notification_calls', e.target.checked));
  $('#notif-statuses').addEventListener('change', (e) => updateSetting('notification_statuses', e.target.checked));
  $('#enable-browser-notif').addEventListener('click', async () => {
    const granted = await requestNotificationPermission();
    toast(granted ? 'Browser notifications enabled' : 'Permission denied', granted ? 'success' : 'error');
  });
}

function renderAppearanceSettings(main) {
  const s = state.settings || {};
  main.innerHTML = `
    <div class="main-header">
      <button class="btn-icon" id="settings-back">${Icon.arrowLeft}</button>
      <div class="main-header-title">Appearance</div>
    </div>
    <div class="main-content" style="padding:16px;overflow-y:auto;">
      <div class="detail-section-title" style="padding:0 4px 8px;">Theme</div>
      <div class="settings-section">
        <div class="settings-item" data-theme="light">
          <div class="settings-item-icon" style="background:rgba(245,158,11,0.15);color:var(--warning);">${Icon.sun}</div>
          <div class="settings-item-body"><div class="settings-item-title">Light</div></div>
          ${s.theme === 'light' ? `<span style="color:var(--brand);">${Icon.check}</span>` : ''}
        </div>
        <div class="settings-item" data-theme="dark">
          <div class="settings-item-icon" style="background:rgba(99,102,241,0.15);color:#6366f1;">${Icon.moon}</div>
          <div class="settings-item-body"><div class="settings-item-title">Dark</div></div>
          ${s.theme === 'dark' ? `<span style="color:var(--brand);">${Icon.check}</span>` : ''}
        </div>
        <div class="settings-item" data-theme="system">
          <div class="settings-item-icon" style="background:var(--bg-active);color:var(--text-secondary);">${Icon.monitor}</div>
          <div class="settings-item-body"><div class="settings-item-title">System Default</div></div>
          ${s.theme === 'system' ? `<span style="color:var(--brand);">${Icon.check}</span>` : ''}
        </div>
      </div>
      <div class="detail-section-title" style="padding:16px 4px 8px;">Chat Settings</div>
      <div class="settings-section">
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">Enter to Send</div>
            <div class="settings-item-sub">Press Enter to send messages (Shift+Enter for new line)</div>
          </div>
          <label class="toggle"><input type="checkbox" id="enter-to-send" ${s.enter_to_send !== false ? 'checked' : ''}><span class="toggle-slider"></span></label>
        </div>
      </div>
    </div>
  `;
  $('#settings-back').addEventListener('click', () => renderSettingsView(main, 'main'));
  main.querySelectorAll('[data-theme]').forEach(item => {
    item.addEventListener('click', async () => {
      const theme = item.dataset.theme;
      await supabase.from('user_settings').update({ theme, updated_at: new Date().toISOString() }).eq('user_id', state.user.id);
      if (state.settings) state.settings.theme = theme;
      applyTheme();
      renderAppearanceSettings(main);
      toast('Theme updated', 'success');
    });
  });
  $('#enter-to-send').addEventListener('change', async (e) => {
    await supabase.from('user_settings').update({ enter_to_send: e.target.checked, updated_at: new Date().toISOString() }).eq('user_id', state.user.id);
    if (state.settings) state.settings.enter_to_send = e.target.checked;
  });
}

function renderAccountSettings(main) {
  main.innerHTML = `
    <div class="main-header">
      <button class="btn-icon" id="settings-back">${Icon.arrowLeft}</button>
      <div class="main-header-title">Account</div>
    </div>
    <div class="main-content" style="padding:16px;overflow-y:auto;">
      <div class="settings-section">
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">Email</div>
            <div class="settings-item-sub">${escapeHtml(state.user?.email || '')}</div>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">Username</div>
            <div class="settings-item-sub">@${escapeHtml(state.profile?.username || '')}</div>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-body">
            <div class="settings-item-title">User ID</div>
            <div class="settings-item-sub" style="font-size:11px;font-family:monospace;">${escapeHtml(state.user?.id || '')}</div>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-item" id="change-pw-btn2">
          <div class="settings-item-icon" style="background:rgba(59,130,246,0.15);color:var(--info);">${Icon.key}</div>
          <div class="settings-item-body"><div class="settings-item-title">Change Password</div></div>
          ${Icon.chevronRight}
        </div>
      </div>
      <div style="padding:16px;">
        <button class="btn btn-danger btn-block" id="delete-account-btn">${Icon.trash2} Delete Account</button>
      </div>
    </div>
  `;
  $('#settings-back').addEventListener('click', () => renderSettingsView(main, 'main'));
  $('#change-pw-btn2').addEventListener('click', showChangePasswordModal);
  $('#delete-account-btn').addEventListener('click', async () => {
    const ok = await confirmDialog('Delete account?', 'This will permanently delete your account and all your data. This cannot be undone.', 'Delete', 'Cancel', true);
    if (!ok) return;
    await supabase.from('profiles').delete().eq('id', state.user.id);
    await supabase.auth.signOut();
    toast('Account deleted', 'success');
  });
}

function renderHelpSettings(main) {
  main.innerHTML = `
    <div class="main-header">
      <button class="btn-icon" id="settings-back">${Icon.arrowLeft}</button>
      <div class="main-header-title">Help</div>
    </div>
    <div class="main-content" style="padding:16px;overflow-y:auto;">
      <div class="settings-section">
        <div class="settings-item">
          <div class="settings-item-icon" style="background:var(--brand-light);color:var(--brand);">${Icon.message}</div>
          <div class="settings-item-body">
            <div class="settings-item-title">Getting Started</div>
            <div class="settings-item-sub">Learn how to use NUVORA</div>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-icon" style="background:var(--bg-active);color:var(--text-secondary);">${Icon.help}</div>
          <div class="settings-item-body">
            <div class="settings-item-title">FAQ</div>
            <div class="settings-item-sub">Common questions</div>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-icon" style="background:var(--bg-active);color:var(--text-secondary);">${Icon.flag}</div>
          <div class="settings-item-body">
            <div class="settings-item-title">Report a Problem</div>
            <div class="settings-item-sub">Tell us about an issue</div>
          </div>
        </div>
      </div>
      <div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">
        <p>NUVORA is a global real-time messaging platform. For support, contact us through the app.</p>
      </div>
    </div>
  `;
  $('#settings-back').addEventListener('click', () => renderSettingsView(main, 'main'));
}

function renderAboutSettings(main) {
  main.innerHTML = `
    <div class="main-header">
      <button class="btn-icon" id="settings-back">${Icon.arrowLeft}</button>
      <div class="main-header-title">About NUVORA</div>
    </div>
    <div class="main-content" style="padding:24px;overflow-y:auto;display:flex;flex-direction:column;align-items:center;text-align:center;">
      <img src="${logoUrl}" alt="NUVORA" style="width:96px;height:96px;margin-bottom:16px;" />
      <h1 style="font-size:28px;font-weight:800;margin-bottom:4px;">NUVORA</h1>
      <p style="color:var(--text-muted);margin-bottom:4px;">Version 1.0.0</p>
      <p style="color:var(--text-muted);font-size:14px;max-width:320px;margin-bottom:24px;">Global real-time messaging, reimagined. Connect with anyone, anywhere, with the power of the NUVO AI assistant.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
        <span style="background:var(--bg-active);padding:6px 12px;border-radius:20px;font-size:12px;">Real-time messaging</span>
        <span style="background:var(--bg-active);padding:6px 12px;border-radius:20px;font-size:12px;">Voice & Video calls</span>
        <span style="background:var(--bg-active);padding:6px 12px;border-radius:20px;font-size:12px;">AI Assistant</span>
        <span style="background:var(--bg-active);padding:6px 12px;border-radius:20px;font-size:12px;">End-to-end secure</span>
      </div>
      <p style="margin-top:24px;font-size:12px;color:var(--text-muted);">Built with HTML, CSS, and JavaScript. Powered by Supabase.</p>
    </div>
  `;
  $('#settings-back').addEventListener('click', () => renderSettingsView(main, 'main'));
}

// ---------- Contacts View ----------
export function renderContactsView(container) {
  if (!state.contacts) return;
  if (state.contacts.length === 0) {
    container.innerHTML = `
      <div class="list-empty">
        ${Icon.contact}
        <p>No contacts yet.<br/>Search for users to add them.</p>
      </div>
    `;
    return;
  }
  container.innerHTML = state.contacts.map(c => {
    const profile = c.profiles || c.contact;
    if (!profile) return '';
    return `
      <div class="member-item" data-user-id="${profile.id}">
        ${avatarHTML(profile, 'md')}
        <div class="member-info">
          <div class="member-name">${escapeHtml(profile.display_name)}</div>
          <div style="font-size:13px;color:var(--text-muted);">@${escapeHtml(profile.username)}</div>
        </div>
        <button class="btn-icon">${Icon.message}</button>
      </div>
    `;
  }).join('');
  container.querySelectorAll('.member-item').forEach(item => {
    item.addEventListener('click', () => showProfileModal(item.dataset.userId));
  });
}

// ---------- Blocked View ----------
export function renderBlockedView(main) {
  const blocked = state.blocked || [];
  main.innerHTML = `
    <div class="main-header">
      <button class="btn-icon" id="blocked-back">${Icon.arrowLeft}</button>
      <div class="main-header-title">Blocked Contacts</div>
    </div>
    <div class="main-content" style="padding:16px;overflow-y:auto;" id="blocked-list">
      ${blocked.length === 0 ? `
        <div class="list-empty">
          ${Icon.block}
          <p>No blocked contacts</p>
        </div>
      ` : blocked.map(b => {
        const profile = b.profiles || b.blocked;
        if (!profile) return '';
        return `
          <div class="member-item" data-user-id="${profile.id}">
            ${avatarHTML(profile, 'md')}
            <div class="member-info">
              <div class="member-name">${escapeHtml(profile.display_name)}</div>
              <div style="font-size:13px;color:var(--text-muted);">@${escapeHtml(profile.username)}</div>
            </div>
            <button class="btn btn-sm btn-ghost unblock-btn" data-user-id="${profile.id}">Unblock</button>
          </div>
        `;
      }).join('')}
    </div>
  `;
  $('#blocked-back')?.addEventListener('click', () => renderSettingsView(main, 'main'));
  main.querySelectorAll('.unblock-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const userId = btn.dataset.userId;
      await supabase.from('blocked_users').delete().eq('user_id', state.user.id).eq('blocked_id', userId);
      state.blocked = state.blocked.filter(b => (b.profiles?.id || b.blocked_id) !== userId);
      emit('blocked', state.blocked);
      renderBlockedView(main);
      toast('User unblocked', 'success');
    });
  });
}

// ---------- Storage View ----------
export function renderStorageView(main) {
  main.innerHTML = `
    <div class="main-header">
      <button class="btn-icon" id="storage-back">${Icon.arrowLeft}</button>
      <div class="main-header-title">Storage & Data</div>
    </div>
    <div class="main-content" style="padding:16px;overflow-y:auto;">
      <div class="detail-section-title">Storage Usage</div>
      <div class="settings-section">
        <div class="settings-item">
          <div class="settings-item-icon" style="background:var(--brand-light);color:var(--brand);">${Icon.image}</div>
          <div class="settings-item-body">
            <div class="settings-item-title">Media</div>
            <div class="settings-item-sub" id="media-count">Loading...</div>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-icon" style="background:rgba(245,158,11,0.15);color:var(--warning);">${Icon.file}</div>
          <div class="settings-item-body">
            <div class="settings-item-title">Documents</div>
            <div class="settings-item-sub" id="docs-count">Loading...</div>
          </div>
        </div>
        <div class="settings-item">
          <div class="settings-item-icon" style="background:rgba(139,92,246,0.15);color:var(--nuvo);">${Icon.mic}</div>
          <div class="settings-item-body">
            <div class="settings-item-title">Voice Messages</div>
            <div class="settings-item-sub" id="voice-count">Loading...</div>
          </div>
        </div>
      </div>
      <div class="detail-section-title" style="padding-top:16px;">Shared Media</div>
      <div class="settings-section">
        <div class="settings-item" id="view-shared-images">
          <div class="settings-item-icon" style="background:var(--brand-light);color:var(--brand);">${Icon.image}</div>
          <div class="settings-item-body"><div class="settings-item-title">Images</div></div>
          ${Icon.chevronRight}
        </div>
        <div class="settings-item" id="view-shared-videos">
          <div class="settings-item-icon" style="background:rgba(239,68,68,0.15);color:var(--error);">${Icon.video}</div>
          <div class="settings-item-body"><div class="settings-item-title">Videos</div></div>
          ${Icon.chevronRight}
        </div>
        <div class="settings-item" id="view-shared-files">
          <div class="settings-item-icon" style="background:rgba(245,158,11,0.15);color:var(--warning);">${Icon.file}</div>
          <div class="settings-item-body"><div class="settings-item-title">Documents</div></div>
          ${Icon.chevronRight}
        </div>
        <div class="settings-item" id="view-shared-links">
          <div class="settings-item-icon" style="background:rgba(34,197,94,0.15);color:var(--success);">${Icon.link}</div>
          <div class="settings-item-body"><div class="settings-item-title">Links</div></div>
          ${Icon.chevronRight}
        </div>
      </div>
    </div>
  `;
  $('#storage-back').addEventListener('click', () => renderSettingsView(main, 'main'));
  loadStorageStats();
}

async function loadStorageStats() {
  const { count: mediaCount } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', state.user.id).in('message_type', ['image', 'video']);
  const { count: docsCount } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', state.user.id).eq('message_type', 'file');
  const { count: voiceCount } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', state.user.id).eq('message_type', 'voice');
  const mEl = $('#media-count'); if (mEl) mEl.textContent = `${mediaCount || 0} items`;
  const dEl = $('#docs-count'); if (dEl) dEl.textContent = `${docsCount || 0} files`;
  const vEl = $('#voice-count'); if (vEl) vEl.textContent = `${voiceCount || 0} messages`;
}

// ---------- Notifications View (sidebar badge) ----------
export function renderNotificationsView() {
  // Placeholder for notifications panel; integrated into chat list
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}
