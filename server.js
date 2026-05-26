import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { initSocket } from './socket/socket.js';
import { setIo } from './utils/socketInstance.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import messageRoutes from './routes/message.routes.js';
import userRoutes from './routes/user.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { generalLimiter } from './middlewares/rateLimiter.middleware.js';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const allowedOrigins = getAllowedOrigins();
const corsOptions = {
    origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
};

// Render runs Express behind a proxy and sends X-Forwarded-* headers.
// express-rate-limit requires this setting to identify clients correctly.
app.set('trust proxy', 1);

// IMPORTANT: Create Socket.io on the HTTP server (not express app)
export const io = new Server(httpServer, {
    cors: {
        origin: corsOptions.origin,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

setIo(io);

// Initialize socket handlers
initSocket(io);

// Connect Database
connectDB();

// Security Middlewares
app.use(helmet());
app.use(cors(corsOptions));

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Rate Limiter
app.use('/api', generalLimiter);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/users', userRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// Global Error Handler (MUST be last middleware)
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Set a different PORT in server/.env and update client/.env to match.`);
        process.exit(1);
    }

    throw error;
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

function getAllowedOrigins() {
    const origins = [
        process.env.CLIENT_URL,
        process.env.CLIENT_URLS,
    ]
        .filter(Boolean)
        .flatMap((value) => value.split(','))
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean);

    if (origins.length === 0) {
        throw new Error('Set CLIENT_URL in server/.env or Render environment variables');
    }

    return [...new Set(origins)];
}

function isAllowedOrigin(origin) {
    if (!origin) return true;

    const normalizedOrigin = origin.trim().replace(/\/$/, '');
    return allowedOrigins.includes(normalizedOrigin) || isAllowedVercelPreviewOrigin(normalizedOrigin);
}

function isAllowedVercelPreviewOrigin(origin) {
    return /^https:\/\/whats-app-clone-client-[a-z0-9-]+-rajendra-bists-projects\.vercel\.app$/i.test(origin);
}
