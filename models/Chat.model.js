import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
    // One-to-one OR group chat (reusing same model)
    isGroupChat: { type: Boolean, default: false },
    chatName: { type: String, trim: true }, // Only for group chats

    // All participants (for 1-to-1: 2 users; for groups: N users)
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],

    // Latest message reference (for sidebar preview + sorting)
    latestMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
    },

    // Group-specific fields
    groupAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    groupAvatar: {
        url: String,
        publicId: String,
    },

    // Per-user unread counts (Map: userId -> count)
    unreadCount: {
        type: Map,
        of: Number,
        default: {},
    },

    // Users who have muted this chat
    mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, {
    timestamps: true,
});

// Prevent duplicate 1-to-1 chats
chatSchema.index({ participants: 1 });
chatSchema.index({ latestMessage: 1 });

export const Chat = mongoose.model('Chat', chatSchema);