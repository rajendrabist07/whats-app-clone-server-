import { User } from '../models/User.model.js';
import { Message } from '../models/Message.model.js';
import { Chat } from '../models/Chat.model.js';
import jwt from 'jsonwebtoken';

// Track userId -> socketId mapping in memory
// In production with multiple servers, use Redis instead
export const onlineUsers = new Map();

export const initSocket = (io) => {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
            if (!token) return next(new Error('Authentication error'));

            const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId).select('-password');
            if (!user) return next(new Error('User not found'));

            socket.user = user; // Attach user to socket
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', async (socket) => {
        console.log(`User connected: ${socket.user.username} (${socket.id})`);

        const userId = socket.user._id.toString();

        // Store socket mapping
        onlineUsers.set(userId, socket.id);

        // Mark user as online in DB
        await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

        // Notify all contacts that this user is online
        socket.broadcast.emit('user_online', { userId, isOnline: true });

        // Join all user's chat rooms automatically
        const chats = await Chat.find({ participants: userId }).select('_id');
        chats.forEach(chat => socket.join(chat._id.toString()));
        console.log(`${socket.user.username} joined ${chats.length} chat rooms`);

        // ─────────────────────────────────────────────────────
        // EVENT: Join a specific chat room
        socket.on('join_chat', (chatId) => {
            socket.join(chatId);
        });

        // EVENT: Typing indicator
        socket.on('typing_start', ({ chatId }) => {
            // Emit to all in room EXCEPT the sender
            socket.to(chatId).emit('typing_start', {
                chatId,
                userId,
                username: socket.user.username,
            });
        });

        socket.on('typing_stop', ({ chatId }) => {
            socket.to(chatId).emit('typing_stop', { chatId, userId });
        });

        // EVENT: Message delivered
        socket.on('message_delivered', async ({ messageId, chatId }) => {
            await Message.findByIdAndUpdate(messageId, {
                [`status.${userId}`]: 'delivered',
            });
            socket.to(chatId).emit('message_status_update', {
                messageId,
                userId,
                status: 'delivered',
            });
        });

        // EVENT: Message seen (user opened the chat)
        socket.on('messages_seen', async ({ chatId }) => {
            // Mark all messages in this chat as seen for this user
            await Message.updateMany(
                {
                    chat: chatId,
                    sender: { $ne: userId },
                    [`status.${userId}`]: { $ne: 'seen' },
                },
                { $set: { [`status.${userId}`]: 'seen' } }
            );

            // Reset unread count for this user
            await Chat.findByIdAndUpdate(chatId, {
                $set: { [`unreadCount.${userId}`]: 0 },
            });

            socket.to(chatId).emit('messages_seen', { chatId, userId });
        });

        // EVENT: Disconnect
        socket.on('disconnect', async () => {
            onlineUsers.delete(userId);
            await User.findByIdAndUpdate(userId, {
                isOnline: false,
                lastSeen: new Date(),
            });
            socket.broadcast.emit('user_offline', { userId, lastSeen: new Date() });
            console.log(`User disconnected: ${socket.user.username}`);
        });
    });
};
