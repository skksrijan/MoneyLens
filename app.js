require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
require('./config/passport'); // Load passport config
const methodOverride = require('method-override');
const flash = require('express-flash');
const connectDB = require('./config/db');
require('./models'); // Load all Mongoose models

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const fs = require('fs');

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
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const transactionRouter = require('./routes/transactions');
const budgetRouter = require('./routes/budgets');
const reportRouter = require('./routes/reports');
const categoryRouter = require('./routes/categories');
const savingsRouter = require('./routes/savings');
const blockchainRouter = require('./routes/blockchain');

const userRouter = require('./routes/user');
const aiRouter = require('./routes/ai');

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
    res.render('index', { title: 'Personal Finance Tracker' });
});

// Database Connect & Server Start
const { initBlockchain } = require('./services/blockchainService');

connectDB().then(async () => {
    await initBlockchain();
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
});
