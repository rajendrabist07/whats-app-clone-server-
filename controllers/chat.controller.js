import { Chat } from '../models/Chat.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const chatPopulate = [
    { path: 'participants', select: 'username email avatar isOnline lastSeen' },
    { path: 'latestMessage', populate: { path: 'sender', select: 'username' } },
];

export const getChats = async (req, res, next) => {
    try {
        const chats = await Chat.find({ participants: req.user._id })
            .populate(chatPopulate)
            .sort({ updatedAt: -1 });

        res.status(200).json(new ApiResponse(200, chats));
    } catch (error) {
        next(error);
    }
};

export const createOrGetOneToOneChat = async (req, res, next) => {
    try {
        const { userId } = req.body;
        if (!userId) throw new ApiError(400, 'userId is required');
        if (userId === req.user._id.toString()) throw new ApiError(400, 'Cannot create a chat with yourself');

        const otherUser = await User.findById(userId);
        if (!otherUser) throw new ApiError(404, 'User not found');

        let chat = await Chat.findOne({
            isGroupChat: false,
            participants: { $all: [req.user._id, userId], $size: 2 },
        }).populate(chatPopulate);

        if (!chat) {
            chat = await Chat.create({
                participants: [req.user._id, userId],
                isGroupChat: false,
            });
            chat = await Chat.findById(chat._id).populate(chatPopulate);
        }

        res.status(201).json(new ApiResponse(201, chat, 'Chat ready'));
    } catch (error) {
        next(error);
    }
};

export const createGroupChat = async (req, res, next) => {
    try {
        const { chatName, participantIds = [] } = req.body;
        const uniqueParticipantIds = [...new Set([...participantIds, req.user._id.toString()])];

        if (!chatName?.trim()) throw new ApiError(400, 'chatName is required');
        if (uniqueParticipantIds.length < 3) throw new ApiError(400, 'Group chat needs at least 3 participants');

        const chat = await Chat.create({
            chatName: chatName.trim(),
            isGroupChat: true,
            participants: uniqueParticipantIds,
            groupAdmin: req.user._id,
        });

        const populatedChat = await Chat.findById(chat._id).populate(chatPopulate);
        res.status(201).json(new ApiResponse(201, populatedChat, 'Group chat created'));
    } catch (error) {
        next(error);
    }
};
