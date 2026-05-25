import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';

export const protect = async (req, res, next) => {
    try {
        let token = req.cookies?.accessToken;

        if (!token && req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) throw new ApiError(401, 'Access denied. No token provided.');

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password -refreshToken');
        if (!user) throw new ApiError(401, 'User no longer exists');

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};
