import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import './config/passport.js';
import cors from 'cors';
import connectDB from './config/db.js';
import './models/index.js';
import fs from 'fs';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// CORS configuration for React SPA
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
        if (process.env.BASE_URL) allowedOrigins.push(process.env.BASE_URL);
        if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Stateful Session Store (MongoDB)
app.use(session({
    secret: process.env.SESSION_SECRET || 'finance_tracker_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/finance_tracker',
        ttl: 14 * 24 * 60 * 60 // 14 days TTL
    })
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';

app.use('/api', apiRouter);
app.use('/auth', authRouter); // Google OAuth routes
app.use('/uploads', express.static(uploadDir));

// Serve React production build
const clientDist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/auth')) {
            return res.sendFile(path.join(clientDist, 'index.html'));
        }
        next();
    });
} else {
    console.warn('⚠️ [MoneyLens] client/dist directory not found. Please run "npm run build".');
    app.get('/', (req, res) => {
        res.status(200).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><title>MoneyLens API</title><style>body{font-family:system-ui,sans-serif;background:#090d16;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}h1{color:#10b981;margin-bottom:8px}p{color:#94a3b8;font-size:16px}</style></head>
            <body><div><h1>MoneyLens Server Operational</h1><p>API is active. Frontend build is initializing...</p></div></body>
            </html>
        `);
    });
}

// Database Connect & Server Start
import { initBlockchain } from './services/blockchainService.js';

connectDB().then(async () => {
    await initBlockchain();
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
});
