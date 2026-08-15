const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Transaction, Category, Budget } = require('../models');
const { convert } = require('../services/currencyService');
const { sendTransactionBudgetUpdate } = require('../services/emailService');
const { parseCSV, parsePDF, parsePDFWithAI, parsePDFWithRegex, detectDuplicates, autoCategorize } = require('../services/importService');
const { addTransactionBlock, addAmendmentBlock, addDeletionBlock } = require('../services/blockchainService');

const isAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/auth/login');

// ── Receipt upload: memory storage → base64 data URI stored in MongoDB ──────
// Reason: Render (and most PaaS free tiers) have EPHEMERAL disk storage.
// Files written to ./uploads/ are wiped on every deploy/restart.
// Storing as base64 in MongoDB means receipts survive restarts permanently.
const receiptUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only images (JPEG/PNG/GIF/WebP) and PDFs allowed for receipts'), false);
    }
});

// ── Statement import: disk storage (temp file, parsed then discarded) ─────────
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, 'stmt-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Helper: convert multer memory buffer to base64 data URI
function bufferToDataUri(file) {
    if (!file) return null;
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

router.get('/', isAuth, async (req, res) => {
    try {
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
        res.render('transactions/index', {
            transactions: displayTransactions,
            categories,
            title: 'Transactions',
            userCurrency
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/add', isAuth, receiptUpload.single('receipt'), async (req, res) => {
    try {
        const { amount, type, date, description, categoryId, currency } = req.body;
        // Store receipt as base64 data URI in MongoDB (survives Render restarts)
        const receiptUrl = bufferToDataUri(req.file);

        const transaction = await Transaction.create({
            amount: parseFloat(amount),
            currency: currency || 'USD',
            type,
            date,
            description,
            receiptUrl,
            categoryId: categoryId || null,
            userId: req.user.id
        });

        // Mine a blockchain block for this transaction (non-blocking on failure)
        try {
            const block = await addTransactionBlock(transaction);
            await Transaction.findByIdAndUpdate(transaction._id, { blockHash: block.hash });
        } catch (blockErr) {
            console.warn('[Blockchain] Failed to mine block for transaction:', blockErr.message);
        }

        const budget = await Budget.findOne({ userId: req.user.id, categoryId: categoryId || null });
        if (budget && categoryId) {
            const now = new Date(date);
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
            const transAmtInUserCurrency = await convert(parseFloat(amount), currency || 'USD', userCurrency);

            await sendTransactionBudgetUpdate(
                req.user.email,
                category.name,
                { amount: transAmtInUserCurrency, type, description },
                limitInUserCurrency,
                spentInUserCurrency,
                userCurrency
            );
        }

        res.redirect('/transactions');
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

router.put('/update', isAuth, receiptUpload.single('receipt'), async (req, res) => {
    try {
        const { id, amount, type, date, description, categoryId, currency } = req.body;

        // Fetch the ORIGINAL transaction BEFORE editing (needed for blockchain amendment)
        const oldTransaction = await Transaction.findOne({ _id: id, userId: req.user.id });

        const updateData = {
            amount: parseFloat(amount),
            currency: currency || 'USD',
            type,
            date,
            description,
            categoryId: categoryId || null
        };

        if (req.file) {
            // Store new receipt as base64 data URI
            updateData.receiptUrl = bufferToDataUri(req.file);
        }

        await Transaction.findOneAndUpdate({ _id: id, userId: req.user.id }, updateData);

        // Mine an AMENDMENT block — records before/after on-chain permanently
        if (oldTransaction) {
            try {
                await addAmendmentBlock(oldTransaction, updateData, oldTransaction.blockHash);
            } catch (blockErr) {
                console.warn('[Blockchain] Failed to mine amendment block:', blockErr.message);
            }
        }

        const budget = await Budget.findOne({ userId: req.user.id, categoryId: categoryId || null });
        if (budget && categoryId) {
            const now = new Date(date);
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
            const transAmtInUserCurrency = await convert(parseFloat(amount), currency || 'USD', userCurrency);

            await sendTransactionBudgetUpdate(
                req.user.email,
                category.name,
                { amount: transAmtInUserCurrency, type, description },
                limitInUserCurrency,
                spentInUserCurrency,
                userCurrency
            );
        }

        res.redirect('/transactions');
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

router.delete('/:id', isAuth, async (req, res) => {
    try {
        // Fetch the transaction BEFORE deleting (for the deletion block snapshot)
        const txToDelete = await Transaction.findOne({ _id: req.params.id, userId: req.user.id });

        await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user.id });

        // Mine a DELETION block — permanent proof this transaction existed and was deleted
        if (txToDelete) {
            try {
                await addDeletionBlock(txToDelete, txToDelete.blockHash);
            } catch (blockErr) {
                console.warn('[Blockchain] Failed to mine deletion block:', blockErr.message);
            }
        }

        res.redirect('/transactions');
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/import', isAuth, (req, res) => {
    res.render('transactions/import', { title: 'Import Bank Statement' });
});

// ── DEBUG: Upload a file and see exactly what text is extracted ──────────────
// Visit /transactions/import/debug-upload , upload the file, and you'll see
// the raw text that pdf-parse / csv-parser extracts. Remove this in production.
router.post('/import/debug', isAuth, upload.single('statement'), async (req, res) => {
    try {
        if (!req.file) return res.json({ error: 'No file uploaded' });
        const filePath  = req.file.path;
        const nameLower = req.file.originalname.toLowerCase();

        if (nameLower.endsWith('.pdf')) {
            const rawText = await parsePDF(filePath);
            const lines   = rawText.split('\n').map((l, i) => `${i}: ${l}`);
            return res.type('text').send(lines.join('\n'));
        }

        if (nameLower.endsWith('.csv')) {
            const fs      = require('fs');
            const content = fs.readFileSync(filePath, 'utf-8');
            return res.type('text').send(content);
        }

        return res.json({ error: 'Unsupported file type', mime: req.file.mimetype });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});


router.post('/import', isAuth, upload.single('statement'), async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error', 'Please upload a CSV or PDF file.');
            return res.redirect('/transactions/import');
        }


        const filePath = req.file.path;
        const userCurrency = req.user.currency || 'USD';
        let pTransactions = [];

        const originalNameLower = req.file.originalname.toLowerCase();

        if (req.file.mimetype === 'text/csv' || originalNameLower.endsWith('.csv')) {
            // parseCSV now handles ALL column detection, date normalisation, and type inference internally
            pTransactions = await parseCSV(filePath, userCurrency);
            console.log(`[Import] CSV parsed: ${pTransactions.length} transactions extracted`);

        } else if (req.file.mimetype === 'application/pdf' || originalNameLower.endsWith('.pdf')) {
            const pdfText = await parsePDF(filePath);
            console.log(`[Import] PDF text length: ${pdfText.length} chars`);

            const apiKey = (process.env.XAI_API_KEY || '').trim();
            if (apiKey && apiKey !== 'your_grok_xai_api_key_here') {
                try {
                    pTransactions = await parsePDFWithAI(pdfText, userCurrency);
                    console.log(`[Import] AI extracted ${pTransactions.length} transactions`);
                } catch (aiErr) {
                    console.warn('[Import] AI parsing failed, falling back to regex:', aiErr.message);
                    pTransactions = parsePDFWithRegex(pdfText, userCurrency);
                }
            } else {
                pTransactions = parsePDFWithRegex(pdfText, userCurrency);
            }
            console.log(`[Import] PDF parsed: ${pTransactions.length} transactions extracted`);
        }

        if (pTransactions.length === 0) {
            req.flash('error', 'No transactions found in the file. Make sure it is a valid bank statement.');
            return res.redirect('/transactions/import');
        }

        const categorized = await autoCategorize(req.user.id, pTransactions);
        const { uniqueTransactions, identifiedDuplicates } = await detectDuplicates(req.user.id, categorized);

        res.render('transactions/import-preview', {
            title: 'Review Import',
            transactions: uniqueTransactions,
            duplicates: identifiedDuplicates,
            categories: await Category.find({ userId: req.user.id })
        });
    } catch (err) {
        console.error('[Import Error]', err);
        req.flash('error', 'Error processing file: ' + err.message);
        res.redirect('/transactions/import');
    }
});

router.post('/import/confirm', isAuth, async (req, res) => {
    try {
        let { transactions } = req.body;
        if (transactions && !Array.isArray(transactions)) {
            transactions = Object.values(transactions);
        }

        if (!transactions || transactions.length === 0) {
            req.flash('error', 'No transactions selected for import.');
            return res.redirect('/transactions/import');
        }

        const toImport = transactions.filter(t => t.active === 'true');

        if (toImport.length === 0) {
            req.flash('error', 'Please select at least one transaction to import.');
            return res.redirect('/transactions/import');
        }

        for (const trans of toImport) {
            const newTx = await Transaction.create({
                amount: parseFloat(trans.amount),
                type: trans.type,
                date: trans.date,
                description: trans.description,
                categoryId: trans.categoryId && trans.categoryId !== '' ? trans.categoryId : null,
                currency: trans.currency || req.user.currency || 'USD',
                userId: req.user.id
            });

            // Mine a blockchain block for each imported transaction
            try {
                const block = await addTransactionBlock(newTx);
                await Transaction.findByIdAndUpdate(newTx._id, { blockHash: block.hash });
            } catch (blockErr) {
                console.warn('[Blockchain] Failed to mine block for imported transaction:', blockErr.message);
            }
        }

        req.flash('success', `${toImport.length} transactions imported successfully!`);
        res.redirect('/transactions');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to save imported transactions.');
        res.redirect('/transactions/import');
    }
});

module.exports = router;
