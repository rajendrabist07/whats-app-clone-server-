import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['message', 'group_invite', 'group_mention', 'friend_request'],
        required: true,
    },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    isRead: { type: Boolean, default: false },
    content: String, // Preview text
}, {
    timestamps: true,
});

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);