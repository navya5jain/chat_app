// server.js - Node.js + Express + Socket.IO Personal Chat Server
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Attach Socket.IO with a 25MB buffer limit to support image, video, and sticker uploads
const io = new Server(server, {
  maxHttpBufferSize: 25 * 1024 * 1024,
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// In-memory user registry: socket.id -> { username }
const usersBySocket = new Map();
// Quick lookup: lowercase username -> socket.id
const socketsByUsername = new Map();

// Helper to broadcast the current list of online users
function broadcastOnlineUsers() {
  const userList = Array.from(usersBySocket.values()).map((u) => u.username);
  io.emit('online-users', userList);
}

io.on('connection', (socket) => {
  console.log(`[Connected] Socket ID: ${socket.id}`);

  // 1. User logs in with a unique username
  socket.on('login', ({ username }, callback) => {
    const cleanName = typeof username === 'string' ? username.trim() : '';

    if (!cleanName || cleanName.length < 2 || cleanName.length > 20) {
      return callback?.({
        success: false,
        error: 'Username must be between 2 and 20 characters.'
      });
    }

    const lowerName = cleanName.toLowerCase();
    if (socketsByUsername.has(lowerName)) {
      return callback?.({
        success: false,
        error: 'That username is already active. Please pick another.'
      });
    }

    usersBySocket.set(socket.id, { username: cleanName });
    socketsByUsername.set(lowerName, socket.id);

    console.log(`[Login] ${cleanName} (${socket.id})`);
    callback?.({ success: true, username: cleanName });

    broadcastOnlineUsers();
  });

  // 2. Direct 1-on-1 Personal Message (text, image, video, or sticker)
  socket.on('private-message', (data, callback) => {
    const sender = usersBySocket.get(socket.id);
    if (!sender) {
      return callback?.({ success: false, error: 'You must log in first.' });
    }

    const toUsername = typeof data?.to === 'string' ? data.to.trim() : '';
    const recipientSocketId = socketsByUsername.get(toUsername.toLowerCase());

    if (!recipientSocketId) {
      return callback?.({ success: false, error: `${toUsername || 'User'} is currently offline.` });
    }

    const type = data?.type || 'text'; // 'text' | 'image' | 'video' | 'sticker'
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    const mediaData = data?.mediaData || null; // Base64 Data URL for image/video/sticker

    // Validate message content
    if (type === 'text') {
      if (!text) {
        return callback?.({ success: false, error: 'Message cannot be empty.' });
      }
      if (text.length > 1000) {
        return callback?.({ success: false, error: 'Message cannot exceed 1000 characters.' });
      }
    } else if (['image', 'video', 'sticker'].includes(type)) {
      if (!mediaData || typeof mediaData !== 'string') {
        return callback?.({ success: false, error: 'Invalid media payload.' });
      }
    } else {
      return callback?.({ success: false, error: 'Unsupported message type.' });
    }

    const messagePayload = {
      id: `${socket.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      from: sender.username,
      to: toUsername,
      type,
      text,
      mediaData,
      timestamp: Date.now(),
      read: false
    };

    // Send to recipient and echo back to sender
    io.to(recipientSocketId).emit('new-private-message', messagePayload);
    socket.emit('new-private-message', messagePayload);

    callback?.({ success: true, message: messagePayload });
  });

  // 3. Typing Indicators (both sides)
  socket.on('typing', ({ to, isTyping }) => {
    const sender = usersBySocket.get(socket.id);
    if (!sender || !to) return;

    const recipientSocketId = socketsByUsername.get(to.toLowerCase());
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('peer-typing', {
        from: sender.username,
        isTyping: Boolean(isTyping)
      });
    }
  });

  // 4. Read Receipts ("Marked as read" badge)
  socket.on('mark-read', ({ to, messageIds }) => {
    const reader = usersBySocket.get(socket.id);
    if (!reader || !to || !Array.isArray(messageIds) || messageIds.length === 0) return;

    const senderSocketId = socketsByUsername.get(to.toLowerCase());
    if (senderSocketId) {
      io.to(senderSocketId).emit('messages-read', {
        by: reader.username,
        messageIds
      });
    }
  });

  // 5. Handle Disconnection
  socket.on('disconnect', () => {
    const user = usersBySocket.get(socket.id);
    if (user) {
      usersBySocket.delete(socket.id);
      socketsByUsername.delete(user.username.toLowerCase());
      console.log(`[Disconnected] ${user.username}`);
      broadcastOnlineUsers();
    }
  });
});

server.listen(PORT, () => {
  console.log('----------------------------------------------------');
  console.log(`💬 Personal Chat Server running at http://localhost:${PORT}`);
  console.log('👉 Open two browser windows to chat 1-on-1 in real time!');
  console.log('----------------------------------------------------');
});
