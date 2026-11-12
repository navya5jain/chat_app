# Direct — Real-Time Personal Chat App

A beginner-friendly, Instagram-inspired 1-on-1 real-time browser chat application built with **Node.js**, **Express**, and **Socket.IO**.

## Live Demo

- **Try it live**: [https://injuries-defined-not-wyoming.trycloudflare.com](https://injuries-defined-not-wyoming.trycloudflare.com)
  *(Note: Hosted via Cloudflare Quick Tunnel—active whenever the local Node server and tunnel are running.)*

## What It Does

**Direct** lets two or more users chat privately in real time directly in their web browsers—no database or account registration required. Each user picks a unique username, sees who is online in the sidebar, and opens a private 1-on-1 conversation.

## Key Features

- **1-on-1 Personal Direct Messages**: Log in with a unique username (2–20 characters, duplicate active names blocked), view online/offline status and unread badges in the sidebar, and send messages up to 1,000 characters.
- **Two-Way Typing Indicators**: Animated typing dots appear in real time in both the chat window and sidebar preview whenever the other person is typing.
- **Read Receipts**: Outgoing messages show `✓` when sent and automatically update to `✓✓` once the recipient views the message.
- **Adjustable Themes**: Switch between 6 built-in themes (**Sunset**, **Classic**, **Midnight**, **Lavender**, **Emerald**, and **Rose**) with preferences saved in `localStorage`.
- **Image & Video Sharing**: Send images (with click-to-enlarge lightbox preview) and videos (with inline playback controls) up to 15 MB.
- **WhatsApp-Style Stickers & Sticker Maker**: Send built-in stickers or design custom stickers on an HTML5 canvas (upload photos, choose background colors, add text, stamp emojis, or draw freehand) and save them to `localStorage`.
- **Mute & Archive Chats**: Silence Web Audio notification chimes for specific chats or move conversations between the **Chats** and **Archived** tabs.

## Tech Stack & Storage

- **Backend**: Node.js, Express, Socket.IO (25 MB buffer limit for media)
- **Frontend**: Vanilla HTML, CSS (CSS variables for theming), JavaScript, HTML5 Canvas, Web Audio API
- **Persistence**: Chat history and online users live in server memory (reset on restart); themes and custom stickers persist in browser `localStorage`.

## Project Structure

```text
socketio-chat-app/
├── package.json          # Project metadata, scripts, and dependencies
├── server.js             # Express HTTP server + Socket.IO WebSocket backend
└── public/               # Frontend static files served to browsers
    ├── index.html        # App layout, modals, and theme structure
    ├── style.css         # Themes, responsive DM layout, and animations
    └── client.js         # Socket.IO client logic, media handling, and sticker maker
