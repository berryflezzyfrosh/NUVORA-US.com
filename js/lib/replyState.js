// js/lib/replyState.js
// Shared reply state to avoid circular dependencies between ui.js and composer.js
let replyToMessage = null;
const listeners = new Set();

export function setReplyTo(msg) {
  replyToMessage = msg;
  listeners.forEach(cb => cb(replyToMessage));
}

export function getReplyTo() { return replyToMessage; }

export function clearReplyTo() {
  replyToMessage = null;
  listeners.forEach(cb => cb(replyToMessage));
}

export function onReplyChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
