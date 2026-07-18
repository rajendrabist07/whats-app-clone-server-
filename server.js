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
import { errorHandler } from './middlewares/error.middleware.js';

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

app.set('trust proxy', 1);

// Initialize Socket.io
export const io = new Server(httpServer, {
    cors: {
        origin: corsOptions.origin,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

setIo(io);
initSocket(io);
connectDB();

// Middlewares
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// REST endpoints
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date(), service: 'Kuraa Socket Server' }));

// Relay POST endpoint for Next.js server to broadcast real-time events
app.post('/api/relay', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        
        if (token !== process.env.JWT_SECRET) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { event, room, data } = req.body;
        if (!event || !room || !data) {
            return res.status(400).json({ success: false, message: 'Missing event, room, or data parameter' });
        }

        io.to(room).emit(event, data);
        return res.status(200).json({ success: true, message: 'Event successfully relayed to room' });
    } catch (error) {
        console.error('Relay error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.use(errorHandler);

const PORT = process.env.PORT || 5001;
httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`);
        process.exit(1);
    }
    throw error;
});

httpServer.listen(PORT, () => {
    console.log(`Kuraa socket server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
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

    // If empty in development, default to localhost standard ports
    if (origins.length === 0) {
        origins.push('http://localhost:3000');
        origins.push('http://localhost:3001');
    }

    return [...new Set(origins)];
}

function isAllowedOrigin(origin) {
    if (!origin) return true;
    const normalizedOrigin = origin.trim().replace(/\/$/, '');
    
    // Allow localhost or Vercel preview domains
    if (normalizedOrigin.startsWith('http://localhost:')) return true;
    
    return allowedOrigins.includes(normalizedOrigin) || isAllowedVercelPreviewOrigin(normalizedOrigin);
}

function isAllowedVercelPreviewOrigin(origin) {
    return /^https:\/\/whats-app-clone-client-[a-z0-9-]+-rajendra-bists-projects\.vercel\.app$/i.test(origin) ||
           /^https:\/\/kuraa-client-[a-z0-9-]+-rajendra-bists-projects\.vercel\.app$/i.test(origin);
}
