import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/webm',
        'application/pdf',
    ];

    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new ApiError(400, 'File type not supported'), false);
};

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 16 * 1024 * 1024 },
});
