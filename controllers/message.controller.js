import { Message } from '../models/Message.model.js';
import { Chat } from '../models/Chat.model.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { getIo } from '../utils/socketInstance.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

// GET /api/v1/messages/:chatId?page=1&limit=30
export const getMessages = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;

        // Verify user is participant
        const chat = await Chat.findOne({
            _id: chatId,
            participants: req.user._id,
        });
        if (!chat) throw new ApiError(404, 'Chat not found');

        const messages = await Message.find({
            chat: chatId,
            deletedFor: { $nin: [req.user._id] }, // Exclude soft-deleted messages
        })
            .populate('sender', 'username avatar isOnline')
            .populate('replyTo', 'content sender messageType')
            .sort({ createdAt: -1 }) // Newest first
            .skip(skip)
            .limit(limit);

        const total = await Message.countDocuments({ chat: chatId });

        return res.status(200).json(new ApiResponse(200, {
            messages: messages.reverse(), // Flip to chronological order
            pagination: {
                page,
                limit,
                total,
                hasMore: total > page * limit,
            },
        }));
    } catch (error) {
        next(error);
    }
};

// POST /api/v1/messages/:chatId
export const sendMessage = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const { content, messageType = 'text', replyTo } = req.body;

        if (!content && !req.file) throw new ApiError(400, 'Message content is required');

        const chat = await Chat.findOne({
            _id: chatId,
            participants: req.user._id,
        });
        if (!chat) throw new ApiError(404, 'Chat not found');

        let mediaData = null;
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer, {
                folder: `whatsapp-clone/messages/${chatId}`,
                resource_type: 'auto',
            });
            mediaData = {
                url: result.secure_url,
                publicId: result.public_id,
                mimeType: req.file.mimetype,
                size: req.file.size,
            };
        }

        // Build initial status object for all participants
        const statusMap = {};
        chat.participants.forEach(participantId => {
            if (participantId.toString() !== req.user._id.toString()) {
                statusMap[participantId.toString()] = 'sent';
            }
        });

        const message = await Message.create({
            chat: chatId,
            sender: req.user._id,
            content,
            messageType: req.file ? messageType : 'text',
            media: mediaData,
            status: statusMap,
            replyTo: replyTo || null,
        });

        // Update chat's latest message (for sidebar preview)
        await Chat.findByIdAndUpdate(chatId, {
            latestMessage: message._id,
            // Increment unread count for all participants except sender
            ...buildUnreadIncrement(chat.participants, req.user._id),
        });

        // Populate and emit via Socket.io
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'username avatar')
            .populate('replyTo', 'content sender');

        // Emit to the chat room — all participants receive it
        getIo()?.to(chatId).emit('new_message', populatedMessage);

        return res.status(201).json(new ApiResponse(201, populatedMessage, 'Message sent'));
    } catch (error) {
        next(error);
    }
};

function buildUnreadIncrement(participants, senderId) {
    const inc = {};
    participants.forEach(id => {
        if (id.toString() !== senderId.toString()) {
            inc[`unreadCount.${id}`] = 1;
        }
    });
    return { $inc: inc };
}
