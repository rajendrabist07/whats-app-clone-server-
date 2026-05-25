import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    chat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true,
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        trim: true,
        maxlength: 4096,
    },

    // Message type
    messageType: {
        type: String,
        enum: ['text', 'image', 'video', 'audio', 'file', 'voice'],
        default: 'text',
    },

    // Media attachments
    media: {
        url: String,
        publicId: String, // Cloudinary ID for deletion
        mimeType: String,
        size: Number,
        duration: Number, // For audio/video in seconds
    },

    // Delivery/read receipts
    // Map: { userId: 'sent' | 'delivered' | 'seen' }
    status: {
        type: Map,
        of: { type: String, enum: ['sent', 'delivered', 'seen'] },
        default: {},
    },

    // Reactions (emoji reactions)
    reactions: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: String,
    }],

    // Reply functionality
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null,
    },

    // Soft delete
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
}, {
    timestamps: true,
});

// Critical indexes for performance
messageSchema.index({ chat: 1, createdAt: -1 }); // Get messages for a chat, newest first
messageSchema.index({ sender: 1 });
messageSchema.index({ createdAt: -1 }); // Pagination

export const Message = mongoose.model('Message', messageSchema);