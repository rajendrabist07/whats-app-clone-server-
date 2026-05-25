import { User } from '../models/User.model.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const getCurrentUser = async (req, res) => {
    res.status(200).json(new ApiResponse(200, req.user));
};

export const searchUsers = async (req, res, next) => {
    try {
        const q = req.query.q?.trim() || '';
        const filter = q
            ? {
                _id: { $ne: req.user._id },
                $or: [
                    { username: { $regex: q, $options: 'i' } },
                    { email: { $regex: q, $options: 'i' } },
                ],
            }
            : { _id: { $ne: req.user._id } };

        const users = await User.find(filter)
            .select('username email avatar isOnline lastSeen')
            .limit(20)
            .sort({ username: 1 });

        res.status(200).json(new ApiResponse(200, users));
    } catch (error) {
        next(error);
    }
};
