// js/auth.js
import { supabase } from './lib/supabase.js';
import { state, setState, loadProfile, loadSettings, applyTheme, emit } from './lib/state.js';
import { $, el, toast, escapeHtml, logoUrl } from './lib/utils.js';
import { Icon } from './lib/icons.js';

let authReady = false;

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await onSignedIn(session.user);
  }
  supabase.auth.onAuthStateChange((event, session) => {
    (async () => {
      if (event === 'SIGNED_IN' && session) {
        await onSignedIn(session.user);
      } else if (event === 'SIGNED_OUT') {
        onSignedOut();
      } else if (event === 'PASSWORD_RECOVERY') {
        renderResetPassword();
      } else if (event === 'USER_UPDATED' && session) {
        await loadProfile();
        emit('auth', state);
      }
    })();
  });
  authReady = true;
}

async function onSignedIn(user) {
  await loadProfile();
  await ensureProfileRow(user);
  await loadSettings();
  applyTheme();
  await updatePresence(true);
  emit('auth', state);
}

function onSignedOut() {
  Object.assign(state, { user: null, profile: null, settings: null, contacts: [], chats: [], activeChatId: null, activeView: 'chats' });
  emit('auth', state);
  renderAuth();
}

async function ensureProfileRow(user) {
  if (state.profile) return;
  const username = (user.email?.split('@')[0] || 'user') + Math.floor(Math.random() * 9000 + 100);
  const displayName = user.email?.split('@')[0] || 'New User';
  const { data } = await supabase.from('profiles').insert({
    id: user.id,
    username,
    display_name: displayName,
  }).select().maybeSingle();
  if (data) state.profile = data;
  await loadSettings();
}

export async function updatePresence(online) {
  if (!state.user) return;
  await supabase.from('profiles').update({
    is_online: online,
    last_seen: new Date().toISOString(),
  }).eq('id', state.user.id);
}

// Heartbeat to keep online status
setInterval(() => {
  if (state.user && document.visibilityState === 'visible') {
    updatePresence(true);
  }
}, 30000);

window.addEventListener('beforeunload', () => {
  if (state.user) updatePresence(false);
});
document.addEventListener('visibilitychange', () => {
  if (state.user) updatePresence(document.visibilityState === 'visible');
});

// ---------- Auth UI ----------
export function renderAuth() {
  const app = $('#app');
  app.innerHTML = '';
  const screen = el('div', { class: 'auth-screen' });
  screen.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <img src="${logoUrl}" alt="NUVORA" />
        <h1>NUVORA</h1>
      </div>
      <p class="auth-subtitle">Global messaging, reimagined.</p>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Log In</button>
        <button class="auth-tab" data-tab="signup">Sign Up</button>
      </div>
      <div id="auth-form-area"></div>
      <div class="auth-footer">
        <a href="#" id="forgot-link">Forgot password?</a>
      </div>
    </div>
  `;
  app.append(screen);

  screen.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      screen.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderForm(tab.dataset.tab);
    });
  });
  screen.querySelector('#forgot-link').addEventListener('click', (e) => {
    e.preventDefault();
    renderForgotPassword();
  });
  renderForm('login');
}

function renderForm(type) {
  const area = $('#auth-form-area');
  if (type === 'login') {
    area.innerHTML = `
      <form class="auth-form" id="login-form">
        <div id="auth-error" class="hidden"></div>
        <div class="input-group">
          <label class="input-label">Email</label>
          <input class="input" type="email" name="email" placeholder="you@example.com" required autocomplete="email" />
        </div>
        <div class="input-group">
          <label class="input-label">Password</label>
          <input class="input" type="password" name="password" placeholder="Your password" required autocomplete="current-password" />
        </div>
        <button class="btn btn-primary btn-block" type="submit">Log In</button>
      </form>
    `;
    $('#login-form').addEventListener('submit', handleLogin);
  } else {
    area.innerHTML = `
      <form class="auth-form" id="signup-form">
        <div id="auth-error" class="hidden"></div>
        <div class="input-group">
          <label class="input-label">Display Name</label>
          <input class="input" type="text" name="display_name" placeholder="Your name" required autocomplete="name" />
        </div>
        <div class="input-group">
          <label class="input-label">Username</label>
          <input class="input" type="text" name="username" placeholder="unique_username" required pattern="[a-z0-9_]{3,20}" autocomplete="username" />
          <span class="input-hint">3-20 chars, lowercase letters, numbers, underscore</span>
        </div>
        <div class="input-group">
          <label class="input-label">Email</label>
          <input class="input" type="email" name="email" placeholder="you@example.com" required autocomplete="email" />
        </div>
        <div class="input-group">
          <label class="input-label">Password</label>
          <input class="input" type="password" name="password" placeholder="At least 6 characters" required minlength="6" autocomplete="new-password" />
        </div>
        <button class="btn btn-primary btn-block" type="submit">Create Account</button>
      </form>
    `;
    $('#signup-form').addEventListener('submit', handleSignup);
  }
}

function showAuthError(msg) {
  const err = $('#auth-error');
  if (!msg) { err.classList.add('hidden'); err.innerHTML = ''; return; }
  err.classList.remove('hidden');
  err.innerHTML = `${Icon.x} <span>${escapeHtml(msg)}</span>`;
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  showAuthError('');
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showAuthError(error.message);
    btn.disabled = false;
    btn.textContent = 'Log In';
  }
  // onAuthStateChange handles the rest
}

async function handleSignup(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  const displayName = form.display_name.value.trim();
  const username = form.username.value.trim().toLowerCase();
  showAuthError('');

  // Check username availability
  const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) {
    showAuthError('That username is already taken.');
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Creating account...';
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName, username } },
  });
  if (error) {
    showAuthError(error.message);
    btn.disabled = false;
    btn.textContent = 'Create Account';
    return;
  }
  if (data.user) {
    // create profile
    await supabase.from('profiles').insert({
      id: data.user.id,
      username,
      display_name: displayName,
    });
    await supabase.from('user_settings').insert({ user_id: data.user.id });
    toast('Welcome to NUVORA!', 'success');
  }
}

function renderForgotPassword() {
  const app = $('#app');
  app.innerHTML = '';
  const screen = el('div', { class: 'auth-screen' });
  screen.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <img src="${logoUrl}" alt="NUVORA" />
        <h1>Reset Password</h1>
      </div>
      <p class="auth-subtitle">We'll email you a reset link.</p>
      <form class="auth-form" id="reset-form">
        <div id="auth-error" class="hidden"></div>
        <div class="input-group">
          <label class="input-label">Email</label>
          <input class="input" type="email" name="email" placeholder="you@example.com" required />
        </div>
        <button class="btn btn-primary btn-block" type="submit">Send Reset Link</button>
        <button class="btn btn-ghost btn-block" type="button" id="back-to-login">Back to Login</button>
      </form>
    </div>
  `;
  app.append(screen);
  $('#back-to-login').addEventListener('click', renderAuth);
  $('#reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      showAuthError(error.message);
      btn.disabled = false;
      btn.textContent = 'Send Reset Link';
    } else {
      toast('Reset link sent! Check your email.', 'success');
      renderAuth();
    }
  });
}

function renderResetPassword() {
  const app = $('#app');
  app.innerHTML = '';
  const screen = el('div', { class: 'auth-screen' });
  screen.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <img src="${logoUrl}" alt="NUVORA" />
        <h1>Set New Password</h1>
      </div>
      <form class="auth-form" id="newpw-form">
        <div id="auth-error" class="hidden"></div>
        <div class="input-group">
          <label class="input-label">New Password</label>
          <input class="input" type="password" name="password" placeholder="At least 6 characters" required minlength="6" />
        </div>
        <button class="btn btn-primary btn-block" type="submit">Update Password</button>
      </form>
    </div>
  `;
  app.append(screen);
  $('#newpw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = e.target.password.value;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      showAuthError(error.message);
    } else {
      toast('Password updated! Please log in.', 'success');
      await supabase.auth.signOut();
      renderAuth();
    }
  });
}

export async function logout() {
  await updatePresence(false);
  await supabase.auth.signOut();
}
