# Direct — Real-Time Personal Chat App

A beginner-friendly, Instagram-inspired 1-on-1 real-time browser chat application built with **HTML, CSS, JavaScript**, **Firebase Realtime Database**, and deployed on **Vercel** (with an optional **Node.js + Express + Socket.IO** local server).

## Live Demo

- **Try it live (24/7)**: [https://chat-app-chi-nine-63.vercel.app](https://chat-app-chi-nine-63.vercel.app)

## What It Does

**Direct** lets two or more users chat privately in real time directly in their web browsers on desktop or mobile. Each user picks a unique username, sees who is online in the sidebar, and opens a private 1-on-1 conversation.

## Key Features

- **1-on-1 Personal Direct Messages**: Log in with a unique username (2–20 characters, duplicate active names blocked), view online/offline status and unread badges in the sidebar, and send messages up to 1,000 characters.
- **Two-Way Typing Indicators**: Animated typing dots appear in real time in both the chat window and sidebar preview whenever the other person is typing.
- **Read Receipts**: Outgoing messages show `✓` when sent and automatically update to `✓✓` once the recipient views the message.
- **Adjustable Themes**: Switch between 6 built-in themes (**Sunset**, **Classic**, **Midnight**, **Lavender**, **Emerald**, and **Rose**) with preferences saved in `localStorage`.
- **Image & Video Sharing**: Send images (with click-to-enlarge lightbox preview) and videos (with inline playback controls) up to 5 MB.
- **WhatsApp-Style Stickers & Sticker Maker**: Send built-in stickers or design custom stickers on an HTML5 canvas (upload photos, choose background colors, add text, stamp emojis, or draw freehand with mouse or touch) and save them to `localStorage`.
- **Mute & Archive Chats**: Silence Web Audio notification chimes for specific chats or move conversations between the **Chats** and **Archived** tabs.

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (CSS variables for theming), JavaScript, HTML5 Canvas, Web Audio API
- **Real-Time Backend**: Firebase Realtime Database (cloud) / Node.js, Express, Socket.IO (local)
- **Hosting**: Vercel (`public/` static deployment)

## Project Structure

```text
socketio-chat-app/
├── package.json          # Project metadata and local Node dependencies
├── server.js             # Optional local Express + Socket.IO server
└── public/               # Deployed static frontend
    ├── index.html        # App layout, modals, and Firebase SDK
    ├── style.css         # Themes, responsive DM layout, and animations
    └── client.js         # Real-time chat logic, media handling, and sticker maker
