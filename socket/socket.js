import { User } from '../models/User.model.js';
import { Message } from '../models/Message.model.js';
import { Chat } from '../models/Chat.model.js';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';

// Track userId -> socketId mapping in memory
export const onlineUsers = new Map();

// Optional Redis client for multi-instance scaling
let redis = null;
if (process.env.REDIS_URL) {
    try {
        redis = new Redis(process.env.REDIS_URL);
        redis.on('connect', () => console.log('Redis connected for presence state tracking'));
        redis.on('error', (err) => console.error('Redis connection error:', err.message));
    } catch (e) {
        console.error('Failed to initialize Redis:', e.message);
    }
}

export const initSocket = (io) => {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
            if (!token) return next(new Error('Authentication error'));

            const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId).select('-password');
            if (!user) return next(new Error('User not found'));

            socket.user = user;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.user._id.toString();
        console.log(`User connected: ${socket.user.username} (${socket.id})`);

        // Store mapping
        onlineUsers.set(userId, socket.id);
        
        if (redis) {
            await redis.hset('kuraa:online_users', userId, socket.id);
            await redis.set(`kuraa:presence:${userId}`, 'online');
        }

        // Mark online in DB
        await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

        // Notify contacts
        socket.broadcast.emit('user_online', { userId, isOnline: true });

        // Join rooms
        const chats = await Chat.find({ participants: userId }).select('_id');
        chats.forEach(chat => socket.join(chat._id.toString()));
        console.log(`${socket.user.username} joined ${chats.length} rooms`);

        // Join specific room manually
        socket.on('join_chat', (chatId) => {
            socket.join(chatId);
        });

        // Typing events
        socket.on('typing_start', ({ chatId }) => {
            socket.to(chatId).emit('typing_start', {
                chatId,
                userId,
                username: socket.user.username,
            });
        });

        socket.on('typing_stop', ({ chatId }) => {
            socket.to(chatId).emit('typing_stop', { chatId, userId });
        });

        // WebRTC CALL SIGNALING EVENTS
        // 1. Call Dialing
        socket.on('call_user', ({ userToCall, signalData, from, name, type }) => {
            const targetSocketId = onlineUsers.get(userToCall);
            if (targetSocketId) {
                io.to(targetSocketId).emit('incoming_call', {
                    signal: signalData,
                    from,
                    name,
                    type, // 'audio' | 'video'
                });
            }
        });

        // 2. Accept Call
        socket.on('answer_call', ({ to, signal }) => {
            const targetSocketId = onlineUsers.get(to);
            if (targetSocketId) {
                io.to(targetSocketId).emit('call_accepted', { signal });
            }
        });

        // 3. End Call
        socket.on('end_call', ({ to }) => {
            const targetSocketId = onlineUsers.get(to);
            if (targetSocketId) {
                io.to(targetSocketId).emit('call_ended');
            }
        });

        // 4. Relay ICE Candidates
        socket.on('ice_candidate', ({ to, candidate }) => {
            const targetSocketId = onlineUsers.get(to);
            if (targetSocketId) {
                io.to(targetSocketId).emit('ice_candidate', { candidate });
            }
        });

        // Message delivered receipt
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

        // Messages read receipt
        socket.on('messages_seen', async ({ chatId }) => {
            await Message.updateMany(
                {
                    chat: chatId,
                    sender: { $ne: userId },
                    [`status.${userId}`]: { $ne: 'seen' },
                },
                { $set: { [`status.${userId}`]: 'seen' } }
            );

            await Chat.findByIdAndUpdate(chatId, {
                $set: { [`unreadCount.${userId}`]: 0 },
            });

            socket.to(chatId).emit('messages_seen', { chatId, userId });
        });

        // Disconnect
        socket.on('disconnect', async () => {
            onlineUsers.delete(userId);
            
            if (redis) {
                await redis.hdel('kuraa:online_users', userId);
                await redis.set(`kuraa:presence:${userId}`, 'offline');
            }

            await User.findByIdAndUpdate(userId, {
                isOnline: false,
                lastSeen: new Date(),
            });
            
            socket.broadcast.emit('user_offline', { userId, lastSeen: new Date() });
            console.log(`User disconnected: ${socket.user.username}`);
        });
    });
};
