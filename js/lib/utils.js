// js/lib/utils.js
import { supabase } from './supabase.js';

// ---------- DOM helpers ----------
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style') node.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

// ---------- Time ----------
export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}
export function formatDateTime(iso) {
  if (!iso) return '';
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}
export function formatLastSeen(iso, isOnline) {
  if (isOnline) return 'online';
  if (!iso) return 'offline';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'last seen just now';
  if (diff < 3600) return `last seen ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `last seen ${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `last seen ${Math.floor(diff / 86400)}d ago`;
  return `last seen ${formatDate(iso)}`;
}
export function formatDuration(sec) {
  if (!sec || sec < 1) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
export function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

// ---------- Avatar ----------
export function avatarHTML(user, size = 'md') {
  const name = user?.display_name || user?.username || '?';
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const online = user?.is_online ? 'avatar-online' : '';
  if (user?.avatar_url) {
    return `<div class="avatar avatar-${size} ${online}"><img src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(name)}" /></div>`;
  }
  return `<div class="avatar avatar-${size} ${online}">${escapeHtml(initials)}</div>`;
}

// ---------- HTML escape ----------
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Linkify ----------
export function linkify(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
}

// ---------- Toast ----------
export function toast(message, type = 'info', duration = 3000) {
  const container = $('#toast-container');
  if (!container) return;
  const t = el('div', { class: `toast ${type}` }, message);
  container.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-10px)'; setTimeout(() => t.remove(), 300); }, duration);
}

// ---------- Modal ----------
export function showModal(content, opts = {}) {
  const root = $('#modal-root');
  const overlay = el('div', { class: 'modal-overlay' });
  if (opts.large) overlay.querySelector('.modal')?.classList.add('modal-large');
  const modal = el('div', { class: `modal${opts.large ? ' modal-large' : ''}` });
  modal.innerHTML = '';
  if (typeof content === 'string') modal.innerHTML = content;
  else modal.append(content);
  overlay.append(modal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && opts.dismissable !== false) closeModal(overlay);
  });
  root.append(overlay);
  return { overlay, modal, close: () => closeModal(overlay) };
}
export function closeModal(overlay) {
  if (!overlay) return;
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 200);
}
export function closeAllModals() {
  $$('.modal-overlay').forEach(closeModal);
}

// ---------- Confirm dialog ----------
export function confirmDialog(title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false) {
  return new Promise((resolve) => {
    const content = el('div', {}, [
      el('div', { class: 'modal-header' }, [
        el('div', { class: 'modal-title', text: title }),
      ]),
      el('div', { class: 'modal-body', text: message }),
      el('div', { class: 'modal-footer' }, [
        el('button', { class: 'btn btn-ghost', onclick: () => { close(); resolve(false); } }, cancelText),
        el('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => { close(); resolve(true); } }, confirmText),
      ]),
    ]);
    const { close } = showModal(content);
  });
}

// ---------- File upload ----------
export async function uploadFile(bucket, file, path) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  return pub.publicUrl;
}

// ---------- Debounce ----------
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------- UUID ----------
export function uuid() {
  return crypto.randomUUID();
}

// ---------- Array helpers ----------
export function toggleArray(arr, val) {
  if (!arr) return [val];
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

// ---------- Media type detection ----------
export function getMediaType(mime) {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

// ---------- Browser notification ----------
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}
export function showBrowserNotification(title, body, data = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;
  const n = new Notification(title, { body, icon: '/nuvora-logo.svg', data });
  n.onclick = () => { window.focus(); n.close(); };
}
