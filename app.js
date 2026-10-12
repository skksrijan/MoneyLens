import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import './config/passport.js'; // Load passport config
import methodOverride from 'method-override';
import flash from 'express-flash';
import cors from 'cors';
import connectDB from './config/db.js';
import './models/index.js'; // Load all Mongoose models
import fs from 'fs';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// CORS setup for React client
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin) return callback(null, true);
        const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
        if (process.env.BASE_URL) allowedOrigins.push(process.env.BASE_URL);
        if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
            callback(null, true);
        } else {
            callback(null, true); // Allow during development
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Middleware
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(flash());

app.use(session({
    secret: process.env.SESSION_SECRET || 'finance_tracker_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/finance_tracker',
        ttl: 14 * 24 * 60 * 60 // 14 days
    })
}));

app.use(passport.initialize());
app.use(passport.session());

// Global variables for templates
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.error = req.flash ? req.flash('error') : null;
    res.locals.success = req.flash ? req.flash('success') : null;
    next();
});

// Routes
import authRouter from './routes/auth.js';
import dashboardRouter from './routes/dashboard.js';
import transactionRouter from './routes/transactions.js';
import budgetRouter from './routes/budgets.js';
import reportRouter from './routes/reports.js';
import categoryRouter from './routes/categories.js';
import savingsRouter from './routes/savings.js';
import blockchainRouter from './routes/blockchain.js';
import userRouter from './routes/user.js';
import aiRouter from './routes/ai.js';
import apiRouter from './routes/api.js';

// REST API for React SPA
app.use('/api', apiRouter);

// Traditional SSR routes
app.use('/auth', authRouter);
app.use('/auth/ai', aiRouter);
app.use('/dashboard', dashboardRouter);
app.use('/transactions', transactionRouter);
app.use('/budgets', budgetRouter);
app.use('/reports', reportRouter);
app.use('/categories', categoryRouter);
app.use('/savings', savingsRouter);
app.use('/user', userRouter);
app.use('/blockchain', blockchainRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve React production build if available
const clientDist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/auth/google')) {
            return res.sendFile(path.join(clientDist, 'index.html'));
        }
        next();
    });
} else {
    app.get('/', (req, res) => {
        if (req.isAuthenticated()) {
            return res.redirect('/dashboard');
        }
        res.render('index', { title: 'MoneyLens' });
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
