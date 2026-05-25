import jwt from 'jsonwebtoken';

export const generateAccessToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN, // 15 minutes — short-lived
    });
};

export const generateRefreshToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN, // 7 days — long-lived
    });
};

export const setTokenCookies = (res, accessToken, refreshToken) => {
    res.cookie('accessToken', accessToken, {
        ...getCookieOptions(),
        maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
        ...getCookieOptions(),
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
};

export const clearTokenCookies = (res) => {
    res.clearCookie('accessToken', getCookieOptions());
    res.clearCookie('refreshToken', getCookieOptions());
};

const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
    };
};
