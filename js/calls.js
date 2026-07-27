// js/calls.js
import { supabase } from './lib/supabase.js';
import { state, emit } from './lib/state.js';
import { $, el, toast, escapeHtml, avatarHTML, formatDuration, formatDateTime, confirmDialog } from './lib/utils.js';
import { Icon } from './lib/icons.js';
import { getProfile } from './profile.js';

// Call history management
export const callHistory = {
  all() { return state.calls || []; },
  async load() {
    if (!state.user) return;
    const { data } = await supabase
      .from('calls')
      .select(`
        *,
        caller:profiles!calls_caller_id_fkey(id, username, display_name, avatar_url),
        callee:profiles!calls_callee_id_fkey(id, username, display_name, avatar_url)
      `)
      .or(`caller_id.eq.${state.user.id},callee_id.eq.${state.user.id}`)
      .order('created_at', { ascending: false })
      .limit(50);
    state.calls = (data || []).map(c => ({
      ...c,
      peer_name: c.caller_id === state.user.id ? c.callee?.display_name : c.caller?.display_name,
      peer_id: c.caller_id === state.user.id ? c.callee_id : c.caller_id,
    }));
    emit('calls', state.calls);
    return state.calls;
  },
  async add(call) {
    const { data } = await supabase.from('calls').insert(call).select().maybeSingle();
    this.load();
    return data;
  },
  async update(id, updates) {
    await supabase.from('calls').update(updates).eq('id', id);
    this.load();
  },
};

// ---------- WebRTC Call ----------
let peerConnection = null;
let localStream = null;
let callChannel = null;
let currentCall = null;
let callTimer = null;
let callStartTime = 0;
let iceCandidatesBuffer = [];

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function getCallState() { return currentCall; }

export async function openCall(calleeId, type, calleeProfile) {
  if (currentCall) { toast('A call is already in progress', 'error'); return; }

  const callee = calleeProfile || await getProfile(calleeId);
  if (!callee) { toast('User not found', 'error'); return; }

  // Create call record
  const { data: callRecord } = await supabase.from('calls').insert({
    caller_id: state.user.id,
    callee_id: calleeId,
    call_type: type,
    status: 'initiated',
    direction: 'outgoing',
  }).select().maybeSingle();

  currentCall = {
    id: callRecord?.id,
    calleeId,
    callee,
    type,
    direction: 'outgoing',
    status: 'initiated',
  };

  renderCallScreen(callee, type, 'outgoing', 'Calling...');

  try {
    localStream = await navigator.mediaDevices.getUserMedia(
      type === 'video' ? { video: true, audio: true } : { audio: true }
    );
    attachLocalStream();

    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (e) => {
      attachRemoteStream(e.streams[0]);
      currentCall.status = 'connected';
      updateCallStatus('Connected');
      callStartTime = Date.now();
      startCallTimer();
    };

    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(calleeId, { type: 'ice', candidate: e.candidate });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
        endCall();
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendSignal(calleeId, { type: 'offer', sdp: offer });

    // Subscribe to signaling channel
    callChannel = supabase.channel(`call-${calleeId}-${state.user.id}`)
      .on('broadcast', { event: 'signal' }, (payload) => {
        handleSignal(payload.payload, calleeId);
      })
      .subscribe();

  } catch (e) {
    toast('Could not access camera/microphone', 'error');
    endCall();
  }
}

export async function receiveCall(callData) {
  if (currentCall) {
    // Already in a call, auto-reject
    await supabase.from('calls').update({ status: 'rejected' }).eq('id', callData.id);
    return;
  }

  const caller = await getProfile(callData.caller_id);
  currentCall = {
    id: callData.id,
    callerId: callData.caller_id,
    caller: caller,
    type: callData.call_type,
    direction: 'incoming',
    status: 'ringing',
  };

  renderIncomingCallScreen(caller, callData.call_type);
}

async function acceptCall() {
  if (!currentCall) return;
  try {
    localStream = await navigator.mediaDevices.getUserMedia(
      currentCall.type === 'video' ? { video: true, audio: true } : { audio: true }
    );
    attachLocalStream();

    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (e) => {
      attachRemoteStream(e.streams[0]);
      currentCall.status = 'connected';
      updateCallStatus('Connected');
      callStartTime = Date.now();
      startCallTimer();
    };

    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(currentCall.callerId, { type: 'ice', candidate: e.candidate });
      }
    };

    callChannel = supabase.channel(`call-${currentCall.callerId}-${state.user.id}`)
      .on('broadcast', { event: 'signal' }, (payload) => {
        handleSignal(payload.payload, currentCall.callerId);
      })
      .subscribe();

    // Update call status
    await supabase.from('calls').update({ status: 'accepted' }).eq('id', currentCall.id);

    // Replace incoming screen with active call screen
    renderCallScreen(currentCall.caller, currentCall.type, 'incoming', 'Connected');

  } catch (e) {
    toast('Could not access camera/microphone', 'error');
    rejectCall();
  }
}

async function rejectCall() {
  if (!currentCall) return;
  await supabase.from('calls').update({ status: 'rejected', ended_at: new Date().toISOString() }).eq('id', currentCall.id);
  cleanupCall();
  $('#call-screen')?.remove();
  currentCall = null;
}

export async function endCall() {
  if (!currentCall) return;
  const duration = callStartTime ? Math.round((Date.now() - callStartTime) / 1000) : 0;
  await supabase.from('calls').update({
    status: 'ended',
    duration,
    ended_at: new Date().toISOString(),
  }).eq('id', currentCall.id);
  cleanupCall();
  $('#call-screen')?.remove();
  callHistory.load();
  currentCall = null;
}

function cleanupCall() {
  clearTimeout(callTimer);
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (callChannel) {
    supabase.removeChannel(callChannel);
    callChannel = null;
  }
  callStartTime = 0;
}

async function sendSignal(toUserId, signal) {
  const channel = supabase.channel(`call-signal-${toUserId}`);
  await channel.subscribe();
  await channel.send({
    type: 'broadcast',
    event: 'signal',
    payload: { ...signal, from: state.user.id },
  });
  // Don't remove immediately; keep for ICE
}

async function handleSignal(signal, otherUserId) {
  if (!peerConnection) return;
  try {
    if (signal.type === 'offer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      sendSignal(otherUserId, { type: 'answer', sdp: answer });
    } else if (signal.type === 'answer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    } else if (signal.type === 'ice') {
      if (peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    }
  } catch (e) {
    console.error('Signal error:', e);
  }
}

function attachLocalStream() {
  const video = $('#call-local-video');
  if (video && localStream) {
    video.srcObject = localStream;
    video.muted = true;
  }
}

function attachRemoteStream(stream) {
  const video = $('#call-remote-video');
  if (video) {
    video.srcObject = stream;
  }
  // Hide avatar, show video
  $('#call-avatar')?.classList.add('hidden');
  $('#call-remote-video')?.classList.remove('hidden');
}

function startCallTimer() {
  clearTimeout(callTimer);
  callTimer = setInterval(() => {
    const dur = Math.round((Date.now() - callStartTime) / 1000);
    const el = $('#call-duration');
    if (el) el.textContent = formatDuration(dur);
  }, 1000);
}

function updateCallStatus(text) {
  const el = $('#call-status-text');
  if (el) el.textContent = text;
}

// ---------- Call UI ----------
function renderCallScreen(peer, type, direction, statusText) {
  $('#call-screen')?.remove();
  const screen = el('div', { class: 'call-screen', id: 'call-screen' });
  screen.innerHTML = `
    <div class="call-video-grid">
      <div class="call-video-remote">
        ${type === 'video' ? `<video id="call-remote-video" autoplay playsinline class="hidden"></video>` : ''}
        <div class="call-info" id="call-avatar" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          ${avatarHTML(peer, 'xl', 'call-avatar-inner')}
          <div class="call-name">${escapeHtml(peer.display_name)}</div>
          <div class="call-status-text" id="call-status-text">${escapeHtml(statusText)}</div>
          <div class="call-status-text" id="call-duration"></div>
        </div>
      </div>
      <div class="call-video-local" style="position:absolute;bottom:0;right:0;width:120px;height:160px;border-radius:12px;overflow:hidden;z-index:3;">
        ${type === 'video' ? `<video id="call-local-video" autoplay playsinline muted></video>` : ''}
      </div>
    </div>
    <div class="call-controls">
      <button class="call-btn" id="call-mute" title="Mute">${Icon.mic}</button>
      ${type === 'video' ? `<button class="call-btn" id="call-video-toggle" title="Camera">${Icon.video}</button>` : ''}
      <button class="call-btn end" id="call-end" title="End call">${Icon.phoneOff}</button>
    </div>
  `;
  document.body.append(screen);

  $('#call-end').addEventListener('click', endCall);
  $('#call-mute').addEventListener('click', () => {
    if (!localStream) return;
    const audio = localStream.getAudioTracks()[0];
    if (audio) {
      audio.enabled = !audio.enabled;
      $('#call-mute').innerHTML = audio.enabled ? Icon.mic : Icon.micOff;
      $('#call-mute').classList.toggle('active', !audio.enabled);
    }
  });
  $('#call-video-toggle')?.addEventListener('click', () => {
    if (!localStream) return;
    const video = localStream.getVideoTracks()[0];
    if (video) {
      video.enabled = !video.enabled;
      $('#call-video-toggle').innerHTML = video.enabled ? Icon.video : Icon.videoOff;
      $('#call-video-toggle').classList.toggle('active', !video.enabled);
    }
  });
}

function renderIncomingCallScreen(caller, type) {
  $('#call-screen')?.remove();
  const screen = el('div', { class: 'call-screen', id: 'call-screen' });
  screen.innerHTML = `
    <div class="call-info" style="z-index:2;">
      ${avatarHTML(caller, 'xl', 'call-avatar')}
      <div class="call-name">${escapeHtml(caller.display_name)}</div>
      <div class="call-status-text">Incoming ${type} call...</div>
    </div>
    <div class="call-controls">
      <button class="call-btn end" id="reject-call" title="Reject">${Icon.phoneOff}</button>
      <button class="call-btn" id="accept-call" style="background:var(--success);" title="Accept">${type === 'video' ? Icon.video : Icon.phone}</button>
    </div>
  `;
  document.body.append(screen);
  $('#reject-call').addEventListener('click', rejectCall);
  $('#accept-call').addEventListener('click', acceptCall);

  // Auto-miss after 30s
  setTimeout(() => {
    if (currentCall?.status === 'ringing') {
      rejectCall();
    }
  }, 30000);
}

// ---------- Realtime subscription for incoming calls ----------
export function subscribeCalls() {
  if (!state.user) return;
  supabase.channel('incoming-calls')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'calls',
      filter: `callee_id=eq.${state.user.id}`,
    }, (payload) => {
      if (payload.new.status === 'initiated') {
        receiveCall(payload.new);
      }
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'calls',
      filter: `callee_id=eq.${state.user.id}`,
    }, (payload) => {
      // Handle status updates
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'calls',
      filter: `caller_id=eq.${state.user.id}`,
    }, (payload) => {
      // Caller gets update that callee accepted/rejected
      if (payload.new.status === 'rejected' && currentCall?.id === payload.new.id) {
        toast('Call rejected', 'info');
        endCall();
      }
    })
    .subscribe();
}

// ---------- Calls View ----------
export function renderCallsView(main) {
  callHistory.load();
  const calls = state.calls || [];
  main.innerHTML = `
    <div class="main-header">
      <div class="main-header-title">Calls</div>
    </div>
    <div class="main-content" id="calls-main-list"></div>
  `;
  renderCallsMainList($('#calls-main-list'));
}

function renderCallsMainList(container) {
  const calls = state.calls || [];
  if (calls.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        ${Icon.phone}
        <h2>No calls yet</h2>
        <p>Start a voice or video call from any direct conversation.</p>
      </div>
    `;
    return;
  }
  container.innerHTML = calls.map(c => {
    const isOutgoing = c.caller_id === state.user.id;
    const isMissed = c.status === 'missed' || c.status === 'rejected';
    const iconClass = isMissed ? 'missed' : (isOutgoing ? 'outgoing' : 'incoming');
    const icon = isMissed ? Icon.phoneMissed : (isOutgoing ? Icon.phoneOutgoing : Icon.phoneIncoming);
    const peer = isOutgoing ? c.callee : c.caller;
    return `
      <div class="call-item" data-peer-id="${c.peer_id}" data-call-type="${c.call_type}">
        <div class="call-icon ${iconClass}">${icon}</div>
        <div class="member-info">
          <div class="member-name">${escapeHtml(c.peer_name || 'Unknown')}</div>
          <div style="font-size:12px;color:var(--text-muted);">${isOutgoing ? 'Outgoing' : 'Incoming'} · ${formatDateTime(c.created_at)} ${c.duration ? '· ' + formatDuration(c.duration) : ''}</div>
        </div>
        <button class="btn-icon call-back-btn">${c.call_type === 'video' ? Icon.video : Icon.phone}</button>
      </div>
    `;
  }).join('');
  container.querySelectorAll('.call-item').forEach(item => {
    item.addEventListener('click', async () => {
      const peerId = item.dataset.peerId;
      const callType = item.dataset.callType;
      const profile = await getProfile(peerId);
      if (profile) openCall(peerId, callType, profile);
    });
  });
}
