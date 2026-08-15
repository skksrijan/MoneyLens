import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from 'passport';
import './config/passport.js'; // Load passport config
import methodOverride from 'method-override';
import flash from 'express-flash';
import connectDB from './config/db.js';
import './models/index.js'; // Load all Mongoose models
import fs from 'fs';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

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
    saveUninitialized: false
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

app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    res.render('index', { title: 'MoneyLens' });
});

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
