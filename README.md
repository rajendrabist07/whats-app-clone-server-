# WhatsApp MERN Server

Express backend for a real-time WhatsApp-style chat application. The server provides authentication, JWT refresh tokens, protected REST APIs, MongoDB persistence, Cloudinary media uploads, rate limiting, centralized error handling, and Socket.io real-time messaging.

## Tech Stack

- Node.js
- Express 5
- MongoDB + Mongoose
- Socket.io
- JWT
- bcryptjs
- Cookie Parser
- Cloudinary
- Multer
- Helmet
- CORS
- Morgan
- Winston
- express-rate-limit
- Nodemon

## Features

- User signup, login, logout, and refresh-token endpoints
- Password hashing with bcrypt
- Access token and refresh token generation
- Refresh token stored in MongoDB for rotation/invalidation
- HTTP-only refresh-token cookie support
- Protected chat, message, and user routes
- One-to-one chat creation/reuse
- Group chat creation
- Paginated message loading
- Message sending with optional media upload
- Cloudinary upload integration
- Socket.io authentication using JWT
- Online/offline presence
- Typing indicators
- Delivered and seen message status events
- Per-user unread count tracking
- Centralized API response and error utilities
- Global and auth-specific rate limiting

## Project Structure

```text
server/
├── config/                  # MongoDB and Cloudinary config
├── controllers/             # Route handlers
├── middlewares/             # Auth, errors, upload, rate limiting
├── models/                  # Mongoose schemas
├── routes/                  # Express route modules
├── socket/                  # Socket.io event handlers
├── utils/                   # Tokens, logger, API helpers
├── package.json             # Scripts and dependencies
├── server.js                # Express/HTTP/Socket entry point
└── README.md
```

## Prerequisites

- Node.js 20+ recommended
- npm
- MongoDB Atlas or local MongoDB
- Cloudinary account if media upload is used
- Running client app for browser testing

## Environment Variables

Create `server/.env`:

```env
NODE_ENV=development
PORT=5001
CLIENT_URL=http://localhost:5173

MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp-mern
# or
# MONGO_URI=mongodb://127.0.0.1:27017/whatsapp-mern

JWT_SECRET=replace_with_strong_access_token_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace_with_strong_refresh_token_secret
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECRET=replace_with_strong_cookie_secret

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

LOG_LEVEL=info
```

Never commit real `.env` files or production secrets.

For Render production, set:

```env
NODE_ENV=production
CLIENT_URL=https://whats-app-clone-client-liart.vercel.app
```

Render will provide `PORT` automatically. The frontend must use the public Render URL:

```env
VITE_API_URL=https://YOUR_RENDER_PUBLIC_URL.onrender.com/api/v1
VITE_SOCKET_URL=https://YOUR_RENDER_PUBLIC_URL.onrender.com
```

The Render service ID, for example `srv-d8a39t7avr4c73d4ji50`, is not the public browser URL.

## Installation

```bash
cd server
npm install
```

## Development

```bash
npm run dev
```

Expected output:

```text
Server running on port 5001 in development mode
MongoDB Connected: <host>
```

Health check:

```text
GET http://localhost:5001/health
```

## Production

```bash
npm start
```

Production notes:

- set `NODE_ENV=production`
- use strong secrets
- use HTTPS so secure cookies work correctly
- configure the exact deployed frontend URL in `CLIENT_URL`
- use a managed MongoDB database
- add persistent logging/monitoring outside the Node process

## API Base URL

```text
http://localhost:5001/api/v1
```

## REST Endpoints

### Auth

| Method | Endpoint              | Access        | Description             |
| ------ | --------------------- | ------------- | ----------------------- |
| `POST` | `/auth/signup`        | Public        | Create user account     |
| `POST` | `/auth/login`         | Public        | Login user              |
| `POST` | `/auth/refresh-token` | Public cookie | Rotate access token     |
| `POST` | `/auth/logout`        | Protected     | Logout and clear tokens |

### Users

| Method | Endpoint           | Access    | Description                    |
| ------ | ------------------ | --------- | ------------------------------ |
| `GET`  | `/users/me`        | Protected | Get current user               |
| `GET`  | `/users/search?q=` | Protected | Search users by username/email |

### Chats

| Method | Endpoint       | Access    | Description                     |
| ------ | -------------- | --------- | ------------------------------- |
| `GET`  | `/chats`       | Protected | List current user's chats       |
| `POST` | `/chats`       | Protected | Create or reuse one-to-one chat |
| `POST` | `/chats/group` | Protected | Create group chat               |

### Messages

| Method | Endpoint                            | Access    | Description             |
| ------ | ----------------------------------- | --------- | ----------------------- |
| `GET`  | `/messages/:chatId?page=1&limit=30` | Protected | Get paginated messages  |
| `POST` | `/messages/:chatId`                 | Protected | Send text/media message |

## Request Examples

Signup:

```json
{
  "username": "Rajendra Bist",
  "email": "rajendrabist@email.com",
  "password": "password123"
}
```

Login:

```json
{
  "email": "rajndrabist@gmail.com.com",
  "password": "password123"
}
```

Create one-to-one chat:

```json
{
  "userId": "USER_OBJECT_ID"
}
```

Create group chat:

```json
{
  "chatName": "Project Team",
  "participantIds": ["USER_ID_1", "USER_ID_2"]
}
```

Send message:

```json
{
  "content": "Hello",
  "messageType": "text"
}
```

## Authentication Flow

1. User logs in or signs up.
2. Server returns an access token in the JSON response.
3. Server also sets refresh-token cookies.
4. Client stores the access token in `localStorage`.
5. Protected HTTP requests send `Authorization: Bearer <token>`.
6. When the access token expires, the client calls `/auth/refresh-token`.
7. Server verifies the refresh token and returns a new access token.

## Socket.io Events

Socket authentication requires a valid JWT access token:

```js
io(SOCKET_URL, {
  auth: { token: accessToken },
  withCredentials: true,
});
```

Client-to-server events:

| Event               | Payload                 | Description            |
| ------------------- | ----------------------- | ---------------------- |
| `join_chat`         | `chatId`                | Join a chat room       |
| `typing_start`      | `{ chatId }`            | Broadcast typing state |
| `typing_stop`       | `{ chatId }`            | Stop typing state      |
| `message_delivered` | `{ messageId, chatId }` | Mark delivered         |
| `messages_seen`     | `{ chatId }`            | Mark messages seen     |

Server-to-client events:

| Event                   | Payload                         | Description           |
| ----------------------- | ------------------------------- | --------------------- |
| `new_message`           | message                         | New populated message |
| `user_online`           | `{ userId, isOnline }`          | User came online      |
| `user_offline`          | `{ userId, lastSeen }`          | User disconnected     |
| `typing_start`          | `{ chatId, userId, username }`  | User is typing        |
| `typing_stop`           | `{ chatId, userId }`            | User stopped typing   |
| `message_status_update` | `{ messageId, userId, status }` | Delivery update       |
| `messages_seen`         | `{ chatId, userId }`            | Seen update           |

## Data Models

Main MongoDB collections:

- `User`: username, email, hashed password, avatar, presence, refresh token, blocked users
- `Chat`: participants, latest message, group metadata, unread counts, muted users
- `Message`: chat, sender, content, media, delivery/read status, reactions, replies, soft delete
- `Notification`: recipient, sender, type, chat/message reference, read state

## Security

- `helmet()` adds common HTTP security headers
- CORS is restricted by `CLIENT_URL`
- refresh cookies are configured through `setTokenCookies`
- passwords are hashed before save
- protected routes use JWT auth middleware
- auth routes have stricter rate limits
- API routes have a general rate limit

## Common Problems

### Port already in use

Error:

```text
Port 5001 is already in use
```

Fix by stopping the old process or changing the server port. If you change the port, update:

- `server/.env` -> `PORT`
- `client/.env` -> `VITE_API_URL`
- `client/.env` -> `VITE_SOCKET_URL`

### MongoDB connection fails

Check:

- `MONGODB_URI` or `MONGO_URI` exists
- the password is URL-encoded if it contains special characters
- your IP address is allowed in MongoDB Atlas
- the database user has read/write permission

### Signup/login returns 500

Check server logs first. Common causes:

- missing MongoDB URI
- invalid JWT secrets
- duplicate email/username
- old server process still running after code changes

### CORS error from frontend

Make sure:

```env
CLIENT_URL=https://whats-app-clone-client-liart.vercel.app
```

matches the actual Vite dev server URL.

## Git and GitHub Workflow

Recommended branch naming:

```text
feature/server-group-chat
fix/server-auth-cookie
chore/server-deps
docs/server-readme
```

Recommended commit style:

```text
feat(server): add group chat endpoint
fix(server): remove callback from async user save hook
docs(server): document socket events
```

Before opening a pull request:

```bash
npm run dev
```

Then manually verify:

- `GET /health`
- signup
- login
- authenticated `GET /users/me`
- chat creation
- message sending
- Socket.io connection

Pull request checklist:

- no `.env` or secrets committed
- API contract changes documented
- new required env vars documented
- client compatibility confirmed
- logs do not expose passwords or tokens
