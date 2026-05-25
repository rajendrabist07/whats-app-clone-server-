import { User } from '../models/User.model.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import {
    generateAccessToken,
    generateRefreshToken,
    setTokenCookies
} from '../utils/generateToken.js';
import jwt from 'jsonwebtoken';

// POST /api/v1/auth/signup
export const signup = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });
        if (existingUser) throw new ApiError(409, 'Email or username already in use');

        const user = await User.create({ username, email, password });

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        // Save refresh token to DB (for rotation/invalidation)
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        setTokenCookies(res, accessToken, refreshToken);

        // Never send password in response
        const userData = user.toObject();
        delete userData.password;
        delete userData.refreshToken;

        return res.status(201).json(
            new ApiResponse(201, { user: userData, accessToken }, 'Account created successfully')
        );
    } catch (error) {
        next(error);
    }
};

// POST /api/v1/auth/login
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // select('+password') — explicitly include password (it has select: false)
        const user = await User.findOne({ email }).select('+password');
        if (!user) throw new ApiError(401, 'Invalid credentials');

        const isMatch = await user.isPasswordMatch(password);
        if (!isMatch) throw new ApiError(401, 'Invalid credentials');

        // Update online status
        user.isOnline = true;
        user.lastSeen = new Date();

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        setTokenCookies(res, accessToken, refreshToken);

        const userData = user.toObject();
        delete userData.password;
        delete userData.refreshToken;

        return res.status(200).json(
            new ApiResponse(200, { user: userData, accessToken }, 'Login successful')
        );
    } catch (error) {
        next(error);
    }
};

// POST /api/v1/auth/refresh-token
export const refreshToken = async (req, res, next) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken;
        if (!incomingRefreshToken) throw new ApiError(401, 'Unauthorized');

        const decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);

        const user = await User.findById(decoded.userId).select('+refreshToken');
        if (!user || user.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, 'Invalid or expired refresh token');
        }

        // Token rotation — generate new pair
        const newAccessToken = generateAccessToken(user._id);
        const newRefreshToken = generateRefreshToken(user._id);

        user.refreshToken = newRefreshToken;
        await user.save({ validateBeforeSave: false });

        setTokenCookies(res, newAccessToken, newRefreshToken);

        return res.status(200).json(
            new ApiResponse(200, { accessToken: newAccessToken }, 'Token refreshed')
        );
    } catch (error) {
        next(error);
    }
};

// POST /api/v1/auth/logout
export const logout = async (req, res, next) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            refreshToken: null,
            isOnline: false,
            lastSeen: new Date(),
        });

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        return res.status(200).json(new ApiResponse(200, {}, 'Logged out successfully'));
    } catch (error) {
        next(error);
    }
};