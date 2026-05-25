import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
    let error = err;

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = new ApiError(400, message);
    }

    // Handle duplicate key (e.g., duplicate email)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        error = new ApiError(400, `${field} already exists`);
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new ApiError(401, 'Invalid token');
    }
    if (err.name === 'TokenExpiredError') {
        error = new ApiError(401, 'Token expired');
    }

    logger.error(error.message, { stack: error.stack, url: req.url });

    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal Server Error',
        errors: error.errors || [],
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
};