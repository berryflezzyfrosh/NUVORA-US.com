// js/app.js — NUVORA entry point
import { initAuth, renderAuth, updatePresence } from './auth.js';
import { initUI, renderAppShell } from './ui.js';
import { state, subscribe, loadProfile, loadSettings, applyTheme } from './lib/state.js';
import { subscribeChatsRealtime } from './chat.js';
import { subscribeCalls, callHistory } from './calls.js';
import { loadStatuses } from './status.js';
import { loadContacts } from './contacts.js';

async function main() {
  // Initialize UI subscriptions
  initUI();

  // Initialize auth
  await initAuth();

  // If user is logged in, render the app
  if (state.user) {
    renderAppShell();
    subscribeChatsRealtime();
    subscribeCalls();
    loadStatuses();
    callHistory.load();
    loadContacts();
  } else {
    renderAuth();
  }

  // React to auth changes
  subscribe('auth', async (s) => {
    if (s.user) {
      renderAppShell();
      subscribeChatsRealtime();
      subscribeCalls();
      loadStatuses();
      callHistory.load();
      loadContacts();
    } else {
      renderAuth();
    }
  });
}

main().catch(err => {
  console.error('NUVORA startup error:', err);
});
