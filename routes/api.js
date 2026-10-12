import express from 'express';
const router = express.Router();
import passport from 'passport';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { User, Transaction, Category, Budget, Saving, SavingPlan, BlockchainBlock } from '../models/index.js';
import { convert } from '../services/currencyService.js';
import { ensureDefaultCategories } from '../services/categoryService.js';
import { sendBudgetAlert, sendBudgetUpdate, sendTransactionBudgetUpdate, sendOTP } from '../services/emailService.js';
import { parseCSV, parsePDF, parsePDFWithAI, parsePDFWithRegex, detectDuplicates, autoCategorize } from '../services/importService.js';
import { addTransactionBlock, addAmendmentBlock, addDeletionBlock, verifyChain, getAllBlocks, DIFFICULTY } from '../services/blockchainService.js';
import { getAnomalies } from '../services/anomalyService.js';
import { getAIResponse } from '../services/aiService.js';

// Auth Guard Middleware for API
const apiAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
};

// Receipt upload (Memory Storage -> base64)
const receiptUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only images and PDFs allowed for receipts'), false);
    }
});

// Statement upload (Disk Storage)
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, 'stmt-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

function bufferToDataUri(file) {
    if (!file) return null;
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/auth/me', (req, res) => {
    if (req.isAuthenticated()) {
        const u = req.user.toObject ? req.user.toObject() : req.user;
        delete u.password;
        delete u.otpCode;
        return res.json({ user: u });
    }
    res.json({ user: null });
});

router.post('/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ error: info?.message || 'Invalid email or password' });

        req.login(user, (loginErr) => {
            if (loginErr) return res.status(500).json({ error: loginErr.message });
            const u = user.toObject ? user.toObject() : user;
            delete u.password;
            return res.json({ success: true, user: u });
        });
    })(req, res, next);
});

router.post('/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }
        let user = await User.findOne({ email: email.toLowerCase() });
        if (user) return res.status(400).json({ error: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            isVerified: true
        });

        await ensureDefaultCategories(newUser._id);

        req.login(newUser, (loginErr) => {
            if (loginErr) return res.status(500).json({ error: loginErr.message });
            const u = newUser.toObject();
            delete u.password;
            return res.json({ success: true, user: u });
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Something went wrong during registration' });
    }
});

router.post('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ error: 'Failed to logout' });
        res.json({ success: true });
    });
});

router.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ error: 'User with this email not found' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        await User.findByIdAndUpdate(user._id, { otpCode: otp, otpExpiry: expiry });
        await sendOTP(email, otp);

        res.json({ success: true, message: 'OTP sent to your email' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

router.post('/auth/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({
            email: email.toLowerCase(),
            otpCode: otp,
            otpExpiry: { $gt: new Date() }
        });
        if (!user) return res.status(400).json({ error: 'Invalid or expired OTP code' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/auth/reset-password', async (req, res) => {
    const { email, otp, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }
    try {
        const user = await User.findOne({
            email: email.toLowerCase(),
            otpCode: otp,
            otpExpiry: { $gt: new Date() }
        });
        if (!user) return res.status(400).json({ error: 'Invalid or expired OTP' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await User.findByIdAndUpdate(user._id, {
            password: hashedPassword,
            otpCode: null,
            otpExpiry: null,
            isVerified: true
        });

        res.json({ success: true, message: 'Password reset successful' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────

router.get('/dashboard', apiAuth, async (req, res) => {
    try {
        const userCurrency = req.user.currency || 'USD';
        await ensureDefaultCategories(req.user.id);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const allTransactions = await Transaction.find({ userId: req.user.id })
            .populate('categoryId')
            .sort({ date: -1 });

        const allConverted = await Promise.all(allTransactions.map(async (t) => {
            const amtInUserCurrency = await convert(parseFloat(t.amount), t.currency || 'USD', userCurrency);
            return { ...t.toObject(), amtInUserCurrency, Category: t.categoryId };
        }));

        const monthlyTransactions = allConverted.filter(t => t.date >= startOfMonth && t.date <= endOfMonth);

        let totalIncome = 0;
        let totalExpense = 0;
        const categoryData = {};
        const incomeCategoryData = {};

        for (const t of monthlyTransactions) {
            const name = t.Category ? t.Category.name : 'Other';
            if (t.type === 'income') {
                totalIncome += t.amtInUserCurrency;
                incomeCategoryData[name] = (incomeCategoryData[name] || 0) + t.amtInUserCurrency;
            } else {
                totalExpense += t.amtInUserCurrency;
                categoryData[name] = (categoryData[name] || 0) + t.amtInUserCurrency;
            }
        }

        const budgets = await Budget.find({ userId: req.user.id }).populate('categoryId');

        const budgetProgress = await Promise.all(budgets.map(async (b) => {
            const catId = b.categoryId ? (b.categoryId._id || b.categoryId).toString() : null;
            const categoryTransactions = monthlyTransactions.filter(t => {
                const tCatId = t.Category ? (t.Category._id || t.Category).toString() : (t.categoryId ? (t.categoryId._id || t.categoryId).toString() : null);
                return tCatId && tCatId === catId;
            });

            const spent = categoryTransactions.reduce((acc, t) => {
                return t.type === 'expense' ? acc + t.amtInUserCurrency : acc - t.amtInUserCurrency;
            }, 0);

            const limitInUserCurrency = await convert(parseFloat(b.amount), 'USD', userCurrency);

            return {
                id: b._id,
                category: b.categoryId ? b.categoryId.name : 'Unknown',
                limit: limitInUserCurrency,
                spent,
                percent: limitInUserCurrency > 0 ? (spent / limitInUserCurrency) * 100 : 0
            };
        }));

        const rawBalance = totalIncome - totalExpense;
        const savings = Math.max(0, rawBalance);
        const monthlyDeficit = rawBalance < 0 ? Math.abs(rawBalance) : 0;

        const savingsData = await Saving.find({ userId: req.user.id });
        const convertedSavings = await Promise.all(savingsData.map(async (s) => {
            return await convert(parseFloat(s.amount), 'USD', userCurrency);
        }));

        let totalSavingsCompiled = convertedSavings.reduce((acc, val) => acc + val, 0);
        totalSavingsCompiled = Math.max(0, totalSavingsCompiled - monthlyDeficit);

        res.json({
            success: true,
            totalIncome,
            totalExpense,
            savings,
            monthlyDeficit,
            totalSavingsCompiled,
            categoryData,
            incomeCategoryData,
            budgetProgress,
            recentTransactions: allConverted.slice(0, 7),
            userCurrency
        });
    } catch (err) {
        console.error('Dashboard API Error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS CRUD & IMPORT
// ─────────────────────────────────────────────────────────────────────────────

router.get('/transactions', apiAuth, async (req, res) => {
    try {
        await ensureDefaultCategories(req.user.id);
        const userCurrency = req.user.currency || 'USD';
        const transactions = await Transaction.find({ userId: req.user.id })
            .populate('categoryId')
            .sort({ date: -1 });

        const displayTransactions = await Promise.all(transactions.map(async (t) => {
            const convertedAmount = await convert(parseFloat(t.amount), t.currency || 'USD', userCurrency);
            return {
                ...t.toObject(),
                convertedAmount,
                Category: t.categoryId
            };
        }));

        const categories = await Category.find({ userId: req.user.id });

        res.json({
            success: true,
            transactions: displayTransactions,
            categories,
            userCurrency
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/transactions', apiAuth, receiptUpload.single('receipt'), async (req, res) => {
    try {
        const { amount, type, date, description, categoryId, currency } = req.body;
        const receiptUrl = bufferToDataUri(req.file);

        const transaction = await Transaction.create({
            amount: parseFloat(amount),
            currency: currency || req.user.currency || 'USD',
            type,
            date: date || new Date().toISOString().split('T')[0],
            description: description || '',
            receiptUrl,
            categoryId: categoryId || null,
            userId: req.user.id
        });

        // Mine blockchain block
        try {
            const block = await addTransactionBlock(transaction);
            await Transaction.findByIdAndUpdate(transaction._id, { blockHash: block.hash });
            transaction.blockHash = block.hash;
        } catch (blockErr) {
            console.warn('[Blockchain] Mining warning:', blockErr.message);
        }

        // Check budget & alert
        if (categoryId) {
            const budget = await Budget.findOne({ userId: req.user.id, categoryId });
            if (budget) {
                const now = new Date(transaction.date);
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

                const monthlyCategoryTransactions = await Transaction.find({
                    userId: req.user.id,
                    categoryId,
                    date: { $gte: startOfMonth, $lte: endOfMonth }
                });

                const convertedValues = await Promise.all(monthlyCategoryTransactions.map(async (t) => {
                    const usdVal = await convert(parseFloat(t.amount), t.currency || 'USD', 'USD');
                    return t.type === 'expense' ? usdVal : -usdVal;
                }));
                const totalSpentUsd = convertedValues.reduce((acc, val) => acc + val, 0);

                const category = await Category.findById(categoryId);
                const userCurrency = req.user.currency || 'USD';
                const limitInUserCurrency = await convert(parseFloat(budget.amount), 'USD', userCurrency);
                const spentInUserCurrency = await convert(totalSpentUsd, 'USD', userCurrency);
                const transAmtInUserCurrency = await convert(parseFloat(amount), currency || userCurrency, userCurrency);

                if (spentInUserCurrency > limitInUserCurrency) {
                    sendBudgetAlert(req.user.email, category ? category.name : 'Category', limitInUserCurrency, spentInUserCurrency);
                }
            }
        }

        res.json({ success: true, transaction });
    } catch (err) {
        console.error('Create transaction error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/transactions/:id', apiAuth, receiptUpload.single('receipt'), async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, type, date, description, categoryId, currency } = req.body;

        const oldTransaction = await Transaction.findOne({ _id: id, userId: req.user.id });
        if (!oldTransaction) return res.status(404).json({ error: 'Transaction not found' });

        const updateData = {
            amount: parseFloat(amount),
            currency: currency || oldTransaction.currency || 'USD',
            type,
            date,
            description,
            categoryId: categoryId || null
        };

        if (req.file) {
            updateData.receiptUrl = bufferToDataUri(req.file);
        }

        const updatedTx = await Transaction.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            updateData,
            { new: true }
        );

        // Mine Amendment Block
        try {
            await addAmendmentBlock(oldTransaction, updateData, oldTransaction.blockHash);
        } catch (blockErr) {
            console.warn('[Blockchain] Amendment mining warning:', blockErr.message);
        }

        res.json({ success: true, transaction: updatedTx });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/transactions/:id', apiAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const txToDelete = await Transaction.findOne({ _id: id, userId: req.user.id });
        if (!txToDelete) return res.status(404).json({ error: 'Transaction not found' });

        await Transaction.findOneAndDelete({ _id: id, userId: req.user.id });

        // Mine Deletion Block
        try {
            await addDeletionBlock(txToDelete, txToDelete.blockHash);
        } catch (blockErr) {
            console.warn('[Blockchain] Deletion mining warning:', blockErr.message);
        }

        res.json({ success: true, message: 'Transaction deleted and recorded on blockchain ledger' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bank statement upload & preview
router.post('/transactions/import', apiAuth, upload.single('statement'), async (req, res) => {
    let filePath = null;
    try {
        if (!req.file) return res.status(400).json({ error: 'Please upload a CSV or PDF file.' });

        filePath = req.file.path;
        const userCurrency = req.user.currency || 'USD';
        let pTransactions = [];
        const originalNameLower = req.file.originalname.toLowerCase();

        if (req.file.mimetype === 'text/csv' || originalNameLower.endsWith('.csv')) {
            pTransactions = await parseCSV(filePath, userCurrency);
        } else if (req.file.mimetype === 'application/pdf' || originalNameLower.endsWith('.pdf')) {
            const pdfPassword = (req.body.password || '').trim();
            const pdfText = await parsePDF(filePath, pdfPassword);

            const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.XAI_API_KEY || '').trim();
            if (apiKey && apiKey !== 'your_grok_xai_api_key_here') {
                try {
                    pTransactions = await parsePDFWithAI(pdfText, userCurrency);
                } catch (aiErr) {
                    pTransactions = parsePDFWithRegex(pdfText, userCurrency);
                }
            } else {
                pTransactions = parsePDFWithRegex(pdfText, userCurrency);
            }
        }

        if (pTransactions.length === 0) {
            return res.status(400).json({ error: 'No valid transactions found in the statement.' });
        }

        const categorized = await autoCategorize(req.user.id, pTransactions);
        const { uniqueTransactions, identifiedDuplicates } = await detectDuplicates(req.user.id, categorized);
        const categories = await Category.find({ userId: req.user.id });

        res.json({
            success: true,
            transactions: uniqueTransactions,
            duplicates: identifiedDuplicates,
            categories
        });
    } catch (err) {
        console.error('Import parse error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) {}
        }
    }
});

// Confirm import batch
router.post('/transactions/import/confirm', apiAuth, async (req, res) => {
    try {
        const { transactions } = req.body;
        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({ error: 'No transactions selected for import' });
        }

        const createdList = [];
        for (const trans of transactions) {
            const newTx = await Transaction.create({
                amount: parseFloat(trans.amount),
                type: trans.type,
                date: trans.date,
                description: trans.description,
                categoryId: trans.categoryId && trans.categoryId !== '' ? trans.categoryId : null,
                currency: trans.currency || req.user.currency || 'USD',
                userId: req.user.id
            });

            try {
                const block = await addTransactionBlock(newTx);
                await Transaction.findByIdAndUpdate(newTx._id, { blockHash: block.hash });
            } catch (bErr) {
                console.warn('[Blockchain] Mining warning during batch import:', bErr.message);
            }
            createdList.push(newTx);
        }

        res.json({
            success: true,
            importedCount: createdList.length,
            message: `${createdList.length} transactions imported and committed to blockchain!`
        });
    } catch (err) {
        console.error('Import confirm error:', err);
        res.status(500).json({ error: 'Failed to save imported transactions' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// BUDGETS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/budgets', apiAuth, async (req, res) => {
    try {
        const userCurrency = req.user.currency || 'USD';
        await ensureDefaultCategories(req.user.id);

        const budgets = await Budget.find({ userId: req.user.id }).populate('categoryId');

        const processedBudgets = await Promise.all(budgets.map(async (b) => {
            const convertedAmount = await convert(parseFloat(b.amount || 0), 'USD', userCurrency);
            return {
                ...b.toObject(),
                convertedAmount,
                Category: b.categoryId
            };
        }));

        const categories = await Category.find({
            type: 'expense',
            $or: [{ userId: req.user.id }, { userId: null }]
        }).sort({ name: 1 });

        res.json({
            success: true,
            budgets: processedBudgets,
            categories,
            userCurrency
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/budgets', apiAuth, async (req, res) => {
    try {
        const { id, categoryId, amount, description } = req.body;
        if (!categoryId || !amount) {
            return res.status(400).json({ error: 'Category and amount are required' });
        }

        const userCurrency = req.user.currency || 'USD';
        const amountInUsd = await convert(parseFloat(amount), userCurrency, 'USD');

        let budget;
        if (id) {
            budget = await Budget.findOneAndUpdate(
                { _id: id, userId: req.user.id },
                { categoryId, amount: amountInUsd, description },
                { new: true }
            );
        } else {
            budget = await Budget.findOne({ userId: req.user.id, categoryId });
            if (budget) {
                budget.amount = amountInUsd;
                budget.description = description;
                await budget.save();
            } else {
                budget = await Budget.create({
                    userId: req.user.id,
                    categoryId,
                    amount: amountInUsd,
                    description
                });
            }
        }

        const category = await Category.findById(categoryId);
        if (category) {
            sendBudgetUpdate(req.user.email, category.name, parseFloat(amount), userCurrency);
        }

        res.json({ success: true, budget });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/budgets/:id', apiAuth, async (req, res) => {
    try {
        await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.json({ success: true, message: 'Budget deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SAVINGS & SAVING PLANS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/savings', apiAuth, async (req, res) => {
    try {
        const userCurrency = req.user.currency || 'USD';
        const savings = await Saving.find({ userId: req.user.id });
        const plans = await SavingPlan.find({ userId: req.user.id });
        const transactions = await Transaction.find({ userId: req.user.id });

        let totalIncome = 0;
        let totalExpense = 0;

        const convertedTransactions = await Promise.all(transactions.map(async (t) => {
            const amt = await convert(parseFloat(t.amount), t.currency || 'USD', userCurrency);
            return { type: t.type, amt };
        }));

        for (const t of convertedTransactions) {
            if (t.type === 'income') totalIncome += t.amt;
            else totalExpense += t.amt;
        }

        const deficit = totalExpense > totalIncome ? totalExpense - totalIncome : 0;

        const processedSavings = await Promise.all(savings.map(async (s) => {
            let amountInUserCurrency = await convert(parseFloat(s.amount), 'USD', userCurrency);
            if (s.isPrimary && deficit > 0) {
                amountInUserCurrency = Math.max(0, amountInUserCurrency - deficit);
            }
            return { ...s.toObject(), amount: amountInUserCurrency };
        }));

        const totalSavings = processedSavings.reduce((acc, curr) => acc + curr.amount, 0);

        res.json({
            success: true,
            savings: processedSavings,
            plans,
            totalSavings,
            monthlyDeficit: deficit,
            userCurrency
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/savings', apiAuth, async (req, res) => {
    try {
        const { source, amount, description, isPrimary } = req.body;
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount)) return res.status(400).json({ error: 'Valid amount is required' });

        const saving = await Saving.create({
            source,
            amount: parsedAmount,
            description,
            isPrimary: isPrimary === true || isPrimary === 'true',
            userId: req.user.id
        });
        res.json({ success: true, saving });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/savings/:id', apiAuth, async (req, res) => {
    try {
        const { source, amount, description, isPrimary } = req.body;
        const saving = await Saving.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { source, amount: parseFloat(amount), description, isPrimary: isPrimary === true || isPrimary === 'true' },
            { new: true }
        );
        res.json({ success: true, saving });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/savings/:id', apiAuth, async (req, res) => {
    try {
        await Saving.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Plans
router.post('/savings/plans', apiAuth, async (req, res) => {
    try {
        const { goalName, targetAmount, month } = req.body;
        const plan = await SavingPlan.create({
            goalName,
            targetAmount: parseFloat(targetAmount),
            month,
            userId: req.user.id
        });
        res.json({ success: true, plan });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/savings/plans/:id/toggle', apiAuth, async (req, res) => {
    try {
        const plan = await SavingPlan.findOne({ _id: req.params.id, userId: req.user.id });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });
        plan.isCompleted = !plan.isCompleted;
        await plan.save();
        res.json({ success: true, plan });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/savings/plans/:id', apiAuth, async (req, res) => {
    try {
        await SavingPlan.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS & ANOMALIES
// ─────────────────────────────────────────────────────────────────────────────

router.get('/reports', apiAuth, async (req, res) => {
    try {
        const { year } = req.query;
        const currentYear = parseInt(year) || new Date().getFullYear();
        const userCurrency = req.user.currency || 'USD';

        const transactions = await Transaction.find({
            userId: req.user.id,
            date: { $gte: `${currentYear}-01-01`, $lte: `${currentYear}-12-31` }
        }).populate('categoryId');

        let totalIncome = 0;
        let totalExpense = 0;

        const transactionEntries = await Promise.all(transactions.map(async (t) => {
            const amt = await convert(parseFloat(t.amount), t.currency || 'USD', userCurrency);
            return { ...t.toObject(), amt, Category: t.categoryId };
        }));

        const expenseCategories = {};
        const incomeCategories = {};

        for (const t of transactionEntries) {
            const catName = t.Category ? t.Category.name : 'Uncategorized';
            if (t.type === 'income') {
                totalIncome += t.amt;
                incomeCategories[catName] = (incomeCategories[catName] || 0) + t.amt;
            } else {
                totalExpense += t.amt;
                expenseCategories[catName] = (expenseCategories[catName] || 0) + t.amt;
            }
        }

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const fullYearBreakdown = [];

        for (let m = 0; m < 12; m++) {
            const monthStr = (m + 1).toString().padStart(2, '0');
            const yearMonth = `${currentYear}-${monthStr}`;
            const monthly = transactionEntries.filter(t => t.date.slice(0, 7) === yearMonth);
            let mi = 0, me = 0;
            for (const t of monthly) {
                if (t.type === 'income') mi += t.amt;
                else me += t.amt;
            }
            fullYearBreakdown.push({
                month: monthNames[m],
                income: mi,
                expense: me,
                savings: mi - me
            });
        }

        res.json({
            success: true,
            currentYear,
            totalIncome,
            totalExpense,
            expenseCategories,
            incomeCategories,
            fullYearBreakdown,
            userCurrency
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/reports/anomalies', apiAuth, async (req, res) => {
    try {
        const anomalies = await getAnomalies(req.user.id);
        const userCurrency = req.user.currency || 'USD';
        res.json({ success: true, anomalies, userCurrency });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/reports/anomalies/dismiss/:id', apiAuth, async (req, res) => {
    try {
        await Transaction.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { isAnomalyDismissed: true }
        );
        res.json({ success: true, message: 'Anomaly dismissed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKCHAIN EXPLORER
// ─────────────────────────────────────────────────────────────────────────────

router.get('/blockchain', apiAuth, async (req, res) => {
    try {
        const blocks = await getAllBlocks();
        const verifyResult = await verifyChain();
        res.json({
            success: true,
            blocks,
            verifyResult,
            difficulty: DIFFICULTY
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/blockchain/verify', apiAuth, async (req, res) => {
    try {
        const result = await verifyChain();
        res.json(result);
    } catch (err) {
        res.status(500).json({ valid: false, reason: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI FINANCIAL ADVISOR (FINANCEGURU)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/ai/chat', apiAuth, async (req, res) => {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    try {
        const response = await getAIResponse(req.user.id, message, history || []);
        res.json({ success: true, response });
    } catch (err) {
        console.error('AI Chat Error:', err);
        res.status(500).json({ error: 'Failed to generate financial advice' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// USER PROFILE & PREFERENCES
// ─────────────────────────────────────────────────────────────────────────────

router.post('/user/currency', apiAuth, async (req, res) => {
    try {
        const { currency } = req.body;
        const user = await User.findByIdAndUpdate(req.user.id, { currency }, { new: true });
        res.json({ success: true, currency: user.currency });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/user/profile', apiAuth, async (req, res) => {
    try {
        const { name, email } = req.body;
        if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { name, email: email.toLowerCase() },
            { new: true }
        );
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/categories', apiAuth, async (req, res) => {
    try {
        const categories = await Category.find({
            $or: [{ userId: req.user.id }, { userId: null }]
        }).sort({ name: 1 });
        res.json({ success: true, categories });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/categories', apiAuth, async (req, res) => {
    try {
        const { name, type } = req.body;
        if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });

        const category = await Category.create({
            name: name.trim(),
            type,
            userId: req.user.id
        });
        res.json({ success: true, category });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
