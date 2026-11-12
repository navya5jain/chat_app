// public/client.js - Personal 1-on-1 Chat Client Logic
const socket = io();

// Application State
let myUsername = null;
let activePeer = null;
let sidebarTab = 'active'; // 'active' | 'archived'
let onlineUsers = [];
let typingTimeout = null;
let isCurrentlyTyping = false;

// Store per-user conversation state: username -> { messages, muted, archived, unreadCount, isTyping }
const conversations = new Map();

// DOM Elements - Login
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const loginError = document.getElementById('login-error');

// DOM Elements - App Shell & Sidebar
const appScreen = document.getElementById('app-screen');
const myAvatar = document.getElementById('my-avatar');
const myUsernameEl = document.getElementById('my-username');
const conversationsList = document.getElementById('conversations-list');
const archivedCountEl = document.getElementById('archived-count');
const tabButtons = document.querySelectorAll('.tab-btn');

// Theme Picker
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themePicker = document.getElementById('theme-picker');
const themeSwatches = document.querySelectorAll('.theme-swatch');

// Chat Panel
const noChatSelected = document.getElementById('no-chat-selected');
const activeChatView = document.getElementById('active-chat-view');
const peerAvatar = document.getElementById('peer-avatar');
const peerNameEl = document.getElementById('peer-name');
const peerStatusEl = document.getElementById('peer-status');
const peerMutedBadge = document.getElementById('peer-muted-badge');
const peerArchivedBadge = document.getElementById('peer-archived-badge');
const muteChatBtn = document.getElementById('mute-chat-btn');
const archiveChatBtn = document.getElementById('archive-chat-btn');
const chatMessages = document.getElementById('chat-messages');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');
const chatError = document.getElementById('chat-error');

// Input Bar & Media
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const mediaBtn = document.getElementById('media-btn');
const mediaInput = document.getElementById('media-input');
const stickerBtn = document.getElementById('sticker-btn');
const stickerTray = document.getElementById('sticker-tray');
const stickerGrid = document.getElementById('sticker-grid');

// Sticker Maker Modal
const openStickerMakerBtn = document.getElementById('open-sticker-maker-btn');
const stickerMakerModal = document.getElementById('sticker-maker-modal');
const closeStickerMakerBtn = document.getElementById('close-sticker-maker-btn');
const stickerCanvas = document.getElementById('sticker-canvas');
const stickerCtx = stickerCanvas.getContext('2d');
const stickerBgUpload = document.getElementById('sticker-bg-upload');
const stickerTextInput = document.getElementById('sticker-text-input');
const stickerColorInput = document.getElementById('sticker-color-input');
const clearStickerBtn = document.getElementById('clear-sticker-btn');
const saveStickerBtn = document.getElementById('save-sticker-btn');

// Lightbox Modal
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');
const closeLightboxBtn = document.getElementById('close-lightbox-btn');

// ==========================================
// 1. Theme Management
// ==========================================
const savedTheme = localStorage.getItem('chat-theme') || 'instagram';
document.documentElement.setAttribute('data-theme', savedTheme);

themeToggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  themePicker.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!themePicker.contains(e.target) && e.target !== themeToggleBtn) {
    themePicker.classList.add('hidden');
  }
});

themeSwatches.forEach((swatch) => {
  swatch.addEventListener('click', () => {
    const theme = swatch.dataset.theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chat-theme', theme);
    themePicker.classList.add('hidden');
  });
});

// ==========================================
// 2. Login & Online Users
// ==========================================
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');

  const username = usernameInput.value.trim();
  if (!username || username.length < 2 || username.length > 20) {
    showError(loginError, 'Username must be between 2 and 20 characters.');
    return;
  }

  socket.emit('login', { username }, (res) => {
    if (res?.success) {
      myUsername = res.username;
      myUsernameEl.textContent = myUsername;
      myAvatar.textContent = myUsername.charAt(0).toUpperCase();

      loginScreen.classList.add('hidden');
      appScreen.classList.remove('hidden');
    } else {
      showError(loginError, res?.error || 'Could not log in.');
    }
  });
});

socket.on('online-users', (users) => {
  onlineUsers = users.filter((u) => u !== myUsername);

  // Ensure every online user has a conversation entry
  onlineUsers.forEach((u) => getOrCreateConversation(u));

  renderSidebar();
  if (activePeer) {
    updatePeerHeaderStatus();
  }
});

function getOrCreateConversation(peer) {
  if (!conversations.has(peer)) {
    conversations.set(peer, {
      messages: [],
      muted: false,
      archived: false,
      unreadCount: 0,
      isTyping: false
    });
  }
  return conversations.get(peer);
}

// ==========================================
// 3. Sidebar Tabs, Mute & Archive
// ==========================================
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    sidebarTab = btn.dataset.tab;
    renderSidebar();
  });
});

muteChatBtn.addEventListener('click', () => {
  if (!activePeer) return;
  const conv = getOrCreateConversation(activePeer);
  conv.muted = !conv.muted;
  updatePeerHeaderStatus();
  renderSidebar();
});

archiveChatBtn.addEventListener('click', () => {
  if (!activePeer) return;
  const conv = getOrCreateConversation(activePeer);
  conv.archived = !conv.archived;
  updatePeerHeaderStatus();
  renderSidebar();
});

function renderSidebar() {
  const allPeers = Array.from(conversations.keys());
  const archivedCount = allPeers.filter((p) => conversations.get(p).archived).length;

  if (archivedCount > 0) {
    archivedCountEl.textContent = archivedCount;
    archivedCountEl.classList.remove('hidden');
  } else {
    archivedCountEl.classList.add('hidden');
  }

  const visiblePeers = allPeers.filter((p) => {
    const conv = conversations.get(p);
    return sidebarTab === 'archived' ? conv.archived : !conv.archived;
  });

  conversationsList.innerHTML = '';

  if (visiblePeers.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'empty-sidebar';
    emptyMsg.textContent =
      sidebarTab === 'archived'
        ? 'No archived chats.'
        : 'Waiting for another user to open the app...';
    conversationsList.appendChild(emptyMsg);
    return;
  }

  visiblePeers.forEach((peer) => {
    const conv = conversations.get(peer);
    const isOnline = onlineUsers.includes(peer);
    const lastMsg = conv.messages[conv.messages.length - 1];

    let preview = isOnline ? 'Active now' : 'Offline';
    if (conv.isTyping) {
      preview = 'Typing...';
    } else if (lastMsg) {
      if (lastMsg.type === 'image') preview = '📷 Photo';
      else if (lastMsg.type === 'video') preview = '🎬 Video';
      else if (lastMsg.type === 'sticker') preview = '✨ Sticker';
      else preview = lastMsg.text;
    }

    const item = document.createElement('div');
    item.className = `conversation-item ${activePeer === peer ? 'active' : ''}`;
    item.addEventListener('click', () => selectConversation(peer));

    item.innerHTML = `
      <div class="avatar">${escapeHTML(peer.charAt(0).toUpperCase())}</div>
      <div class="conv-meta">
        <div class="conv-top">
          <span class="conv-name">
            ${escapeHTML(peer)}
            ${isOnline ? '<span class="online-dot" title="Online"></span>' : ''}
            ${conv.muted ? '<span title="Muted">🔇</span>' : ''}
          </span>
          ${conv.unreadCount > 0 ? `<span class="unread-badge">${conv.unreadCount}</span>` : ''}
        </div>
        <div class="conv-preview">${escapeHTML(preview)}</div>
      </div>
    `;

    conversationsList.appendChild(item);
  });
}

function selectConversation(peer) {
  activePeer = peer;
  const conv = getOrCreateConversation(peer);
  conv.unreadCount = 0;

  noChatSelected.classList.add('hidden');
  activeChatView.classList.remove('hidden');

  peerAvatar.textContent = peer.charAt(0).toUpperCase();
  peerNameEl.textContent = peer;

  updatePeerHeaderStatus();
  renderMessages();
  renderSidebar();
  markIncomingAsRead(peer);
  messageInput.focus();
}

function updatePeerHeaderStatus() {
  if (!activePeer) return;
  const conv = getOrCreateConversation(activePeer);
  const isOnline = onlineUsers.includes(activePeer);

  peerStatusEl.textContent = isOnline ? 'Active now' : 'Offline';
  peerMutedBadge.classList.toggle('hidden', !conv.muted);
  peerArchivedBadge.classList.toggle('hidden', !conv.archived);

  muteChatBtn.textContent = conv.muted ? '🔔 Unmute' : '🔕 Mute';
  muteChatBtn.classList.toggle('active', conv.muted);

  archiveChatBtn.textContent = conv.archived ? '📤 Unarchive' : '📦 Archive';
  archiveChatBtn.classList.toggle('active', conv.archived);

  typingText.textContent = `${activePeer} is typing...`;
  typingIndicator.classList.toggle('hidden', !conv.isTyping);
}

// ==========================================
// 4. Messaging, Read Receipts & Typing
// ==========================================
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  chatError.classList.add('hidden');
  if (!activePeer) return;

  const text = messageInput.value.trim();
  if (!text) return;

  if (text.length > 1000) {
    showError(chatError, 'Message cannot exceed 1000 characters.');
    return;
  }

  messageInput.value = '';
  stopTypingNow();

  socket.emit(
    'private-message',
    { to: activePeer, type: 'text', text },
    (ack) => {
      if (!ack?.success) {
        showError(chatError, ack?.error || 'Failed to send message.');
      }
    }
  );
});

// Typing indicator emitter
messageInput.addEventListener('input', () => {
  if (!activePeer) return;

  if (!isCurrentlyTyping) {
    isCurrentlyTyping = true;
    socket.emit('typing', { to: activePeer, isTyping: true });
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTypingNow, 1500);
});

function stopTypingNow() {
  if (isCurrentlyTyping && activePeer) {
    isCurrentlyTyping = false;
    socket.emit('typing', { to: activePeer, isTyping: false });
  }
  clearTimeout(typingTimeout);
}

// Typing indicator listener
socket.on('peer-typing', ({ from, isTyping }) => {
  const conv = getOrCreateConversation(from);
  conv.isTyping = isTyping;

  if (activePeer === from) {
    updatePeerHeaderStatus();
  }
  renderSidebar();
});

// Incoming private message
socket.on('new-private-message', (msg) => {
  const isOutgoing = msg.from === myUsername;
  const peer = isOutgoing ? msg.to : msg.from;
  const conv = getOrCreateConversation(peer);

  conv.messages.push(msg);

  if (!isOutgoing) {
    if (activePeer === peer && !document.hidden) {
      markIncomingAsRead(peer);
    } else {
      conv.unreadCount += 1;
    }

    if (!conv.muted) {
      playNotificationTone();
    }
  }

  if (activePeer === peer) {
    renderMessages();
  }
  renderSidebar();
});

// Mark unread incoming messages as read
function markIncomingAsRead(peer) {
  const conv = getOrCreateConversation(peer);
  const unreadIds = conv.messages
    .filter((m) => m.from === peer && !m.read)
    .map((m) => {
      m.read = true;
      return m.id;
    });

  if (unreadIds.length > 0) {
    socket.emit('mark-read', { to: peer, messageIds: unreadIds });
  }
}

window.addEventListener('focus', () => {
  if (activePeer) {
    markIncomingAsRead(activePeer);
    const conv = getOrCreateConversation(activePeer);
    conv.unreadCount = 0;
    renderSidebar();
  }
});

// Sender receives read receipt
socket.on('messages-read', ({ by, messageIds }) => {
  const conv = getOrCreateConversation(by);
  let updated = false;
  conv.messages.forEach((m) => {
    if (messageIds.includes(m.id)) {
      m.read = true;
      updated = true;
    }
  });
  if (updated && activePeer === by) {
    renderMessages();
  }
});

// Render Message Thread (NO latency badges)
function renderMessages() {
  if (!activePeer) return;
  const conv = getOrCreateConversation(activePeer);
  chatMessages.innerHTML = '';

  conv.messages.forEach((msg) => {
    const isOutgoing = msg.from === myUsername;
    const row = document.createElement('div');
    row.className = `message-row ${isOutgoing ? 'outgoing' : 'incoming'}`;

    // Content rendering by message type
    if (msg.type === 'text') {
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = msg.text;
      row.appendChild(bubble);
    } else if (msg.type === 'image') {
      const mediaWrap = document.createElement('div');
      mediaWrap.className = 'media-bubble';
      const img = document.createElement('img');
      img.className = 'chat-image';
      img.src = msg.mediaData;
      img.alt = 'Shared image';
      img.addEventListener('click', () => openLightbox(msg.mediaData));
      mediaWrap.appendChild(img);
      row.appendChild(mediaWrap);
    } else if (msg.type === 'video') {
      const mediaWrap = document.createElement('div');
      mediaWrap.className = 'media-bubble';
      const video = document.createElement('video');
      video.className = 'chat-video';
      video.src = msg.mediaData;
      video.controls = true;
      mediaWrap.appendChild(video);
      row.appendChild(mediaWrap);
    } else if (msg.type === 'sticker') {
      const sticker = document.createElement('img');
      sticker.className = 'chat-sticker';
      sticker.src = msg.mediaData;
      sticker.alt = 'Sticker';
      row.appendChild(sticker);
    }

    // Footer: Clean timestamp + Marked as read badge
    const footer = document.createElement('div');
    footer.className = 'msg-footer';

    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
    const timeSpan = document.createElement('span');
    timeSpan.textContent = timeStr;
    footer.appendChild(timeSpan);

    if (isOutgoing) {
      const statusSpan = document.createElement('span');
      if (msg.read) {
        statusSpan.className = 'read-badge';
        statusSpan.textContent = '✓✓';
        statusSpan.title = 'Read';
      } else {
        statusSpan.textContent = '✓';
        statusSpan.title = 'Sent';
      }
      footer.appendChild(statusSpan);
    }

    row.appendChild(footer);
    chatMessages.appendChild(row);
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==========================================
// 5. Image & Video Sharing
// ==========================================
mediaBtn.addEventListener('click', () => mediaInput.click());

mediaInput.addEventListener('change', () => {
  chatError.classList.add('hidden');
  const file = mediaInput.files?.[0];
  mediaInput.value = '';
  if (!file || !activePeer) return;

  // Limit to 15MB for smooth WebSocket transfer
  const maxBytes = 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    showError(chatError, 'Media file is too large (max 15 MB).');
    return;
  }

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) {
    showError(chatError, 'Please select a valid image or video file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    socket.emit(
      'private-message',
      {
        to: activePeer,
        type: isImage ? 'image' : 'video',
        mediaData: reader.result
      },
      (ack) => {
        if (!ack?.success) {
          showError(chatError, ack?.error || 'Could not send media.');
        }
      }
    );
  };
  reader.readAsDataURL(file);
});

function openLightbox(src) {
  lightboxImg.src = src;
  lightboxModal.classList.remove('hidden');
}

closeLightboxBtn.addEventListener('click', () => lightboxModal.classList.add('hidden'));
lightboxModal.addEventListener('click', (e) => {
  if (e.target === lightboxModal) lightboxModal.classList.add('hidden');
});

// ==========================================
// 6. WhatsApp-Style Stickers & Sticker Maker
// ==========================================
const DEFAULT_STICKER_EMOJIS = ['😂', '🔥', '❤️', '👍', '🥳', '😭', '😎', '🙏'];
let customStickers = JSON.parse(localStorage.getItem('custom-stickers') || '[]');

function createEmojiStickerDataUrl(emoji) {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.font = '110px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 80, 86);
  return c.toDataURL('image/png');
}

function renderStickerGrid() {
  stickerGrid.innerHTML = '';
  const allStickers = [
    ...customStickers,
    ...DEFAULT_STICKER_EMOJIS.map((em) => createEmojiStickerDataUrl(em))
  ];

  allStickers.forEach((dataUrl) => {
    const item = document.createElement('div');
    item.className = 'sticker-item';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = 'Sticker';
    item.appendChild(img);

    item.addEventListener('click', () => {
      if (!activePeer) return;
      stickerTray.classList.add('hidden');
      socket.emit('private-message', {
        to: activePeer,
        type: 'sticker',
        mediaData: dataUrl
      });
    });

    stickerGrid.appendChild(item);
  });
}

stickerBtn.addEventListener('click', () => {
  renderStickerGrid();
  stickerTray.classList.toggle('hidden');
});

// Sticker Maker Canvas Logic
let stickerBgColor = 'transparent';
let stickerUploadedImg = null;
let isDrawing = false;
let lastDrawPos = null;
const drawStrokes = []; // Persist freehand strokes across redraws

openStickerMakerBtn.addEventListener('click', () => {
  stickerTray.classList.add('hidden');
  resetStickerCanvas();
  stickerMakerModal.classList.remove('hidden');
});

closeStickerMakerBtn.addEventListener('click', () => {
  stickerMakerModal.classList.add('hidden');
});

function resetStickerCanvas() {
  stickerBgColor = 'transparent';
  stickerUploadedImg = null;
  stickerTextInput.value = '';
  drawStrokes.length = 0;
  document.querySelectorAll('.shape-btn').forEach((b) => b.classList.remove('active'));
  document.querySelector('.shape-btn[data-bg="transparent"]').classList.add('active');
  redrawStickerCanvas();
}

clearStickerBtn.addEventListener('click', resetStickerCanvas);

document.querySelectorAll('.shape-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.shape-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    stickerBgColor = btn.dataset.bg;
    redrawStickerCanvas();
  });
});

stickerBgUpload.addEventListener('change', () => {
  const file = stickerBgUpload.files?.[0];
  stickerBgUpload.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      stickerUploadedImg = img;
      redrawStickerCanvas();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

stickerTextInput.addEventListener('input', redrawStickerCanvas);
stickerColorInput.addEventListener('input', redrawStickerCanvas);

document.querySelectorAll('.emoji-stamp').forEach((btn) => {
  btn.addEventListener('click', () => {
    stickerTextInput.value = `${stickerTextInput.value}${btn.dataset.emoji}`;
    redrawStickerCanvas();
  });
});

// Freehand drawing on the sticker canvas
stickerCanvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  lastDrawPos = getCanvasCoords(e);
});

stickerCanvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  const pos = getCanvasCoords(e);
  drawStrokes.push({
    from: lastDrawPos,
    to: pos,
    color: stickerColorInput.value
  });
  lastDrawPos = pos;
  redrawStickerCanvas();
});

window.addEventListener('mouseup', () => {
  isDrawing = false;
  lastDrawPos = null;
});

function getCanvasCoords(e) {
  const rect = stickerCanvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function redrawStickerCanvas() {
  const w = stickerCanvas.width;
  const h = stickerCanvas.height;
  stickerCtx.clearRect(0, 0, w, h);

  // 1. Optional rounded background shape
  if (stickerBgColor !== 'transparent') {
    stickerCtx.fillStyle = stickerBgColor;
    stickerCtx.beginPath();
    stickerCtx.roundRect(10, 10, w - 20, h - 20, 36);
    stickerCtx.fill();
  }

  // 2. Optional uploaded photo (clipped to rounded square)
  if (stickerUploadedImg) {
    stickerCtx.save();
    stickerCtx.beginPath();
    stickerCtx.roundRect(12, 12, w - 24, h - 24, 32);
    stickerCtx.clip();

    const scale = Math.max((w - 24) / stickerUploadedImg.width, (h - 24) / stickerUploadedImg.height);
    const drawW = stickerUploadedImg.width * scale;
    const drawH = stickerUploadedImg.height * scale;
    stickerCtx.drawImage(stickerUploadedImg, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
    stickerCtx.restore();
  }

  // 3. Freehand strokes
  drawStrokes.forEach((s) => {
    stickerCtx.strokeStyle = s.color;
    stickerCtx.lineWidth = 5;
    stickerCtx.lineCap = 'round';
    stickerCtx.beginPath();
    stickerCtx.moveTo(s.from.x, s.from.y);
    stickerCtx.lineTo(s.to.x, s.to.y);
    stickerCtx.stroke();
  });

  // 4. Sticker Text Overlay
  const caption = stickerTextInput.value.trim();
  if (caption) {
    stickerCtx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif';
    stickerCtx.textAlign = 'center';
    stickerCtx.textBaseline = 'middle';
    stickerCtx.lineWidth = 5;
    stickerCtx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    stickerCtx.strokeText(caption, w / 2, h - 38);
    stickerCtx.fillStyle = stickerColorInput.value;
    stickerCtx.fillText(caption, w / 2, h - 38);
  }
}

saveStickerBtn.addEventListener('click', () => {
  const dataUrl = stickerCanvas.toDataURL('image/png');
  customStickers.unshift(dataUrl);
  if (customStickers.length > 16) customStickers.pop();
  localStorage.setItem('custom-stickers', JSON.stringify(customStickers));

  stickerMakerModal.classList.add('hidden');
  if (activePeer) {
    socket.emit('private-message', {
      to: activePeer,
      type: 'sticker',
      mediaData: dataUrl
    });
  }
});

// ==========================================
// 7. Helper Utilities & Subtle Notification Sound
// ==========================================
function playNotificationTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (_) {
    // Ignore audio context restrictions if user hasn't interacted yet
  }
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c] || c));
}
