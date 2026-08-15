const express = require('express');
const router = express.Router();
const { Saving, SavingPlan, Transaction } = require('../models');
const { convert } = require('../services/currencyService');

const isAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/auth/login');

router.get('/', isAuth, async (req, res) => {
    try {
        const userCurrency = req.user.currency || 'USD';
        const savings = await Saving.find({ userId: req.user.id });
        const plans = await SavingPlan.find({ userId: req.user.id });

        const transactions = await Transaction.find({ userId: req.user.id });

        let totalIncome = 0;
        let totalExpense = 0;

        // Parallelize transaction conversions
        const convertedTransactions = await Promise.all(transactions.map(async (t) => {
            const amt = await convert(parseFloat(t.amount), t.currency || 'USD', userCurrency);
            return { type: t.type, amt };
        }));

        for (const t of convertedTransactions) {
            if (t.type === 'income') totalIncome += t.amt;
            else totalExpense += t.amt;
        }

        const deficit = totalExpense > totalIncome ? totalExpense - totalIncome : 0;

        // Parallelize savings conversions
        const processedSavings = await Promise.all(savings.map(async (s) => {
            let amountInUserCurrency = await convert(parseFloat(s.amount), 'USD', userCurrency);
            if (s.isPrimary && deficit > 0) {
                amountInUserCurrency = Math.max(0, amountInUserCurrency - deficit);
            }
            return { ...s.toObject(), amount: amountInUserCurrency };
        }));

        const totalSavings = processedSavings.reduce((acc, curr) => acc + curr.amount, 0);

        res.render('savings/index', {
            title: 'Savings',
            savings: processedSavings,
            plans,
            totalSavings,
            monthlyDeficit: deficit,
            userCurrency
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/add', isAuth, async (req, res) => {
    try {
        const { source, amount, description, isPrimary } = req.body;
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount)) throw new Error('Invalid amount');

        await Saving.create({
            source,
            amount: parsedAmount, // Stored as USD base consistently
            description,
            isPrimary: isPrimary === 'true',
            userId: req.user.id
        });
        res.redirect('/savings');
    } catch (err) {
        console.error(err);
        res.redirect('/savings');
    }
});

router.put('/update', isAuth, async (req, res) => {
    try {
        const { id, source, amount, description, isPrimary } = req.body;
        await Saving.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            { source, amount: parseFloat(amount), description, isPrimary: isPrimary === 'true' }
        );
        res.redirect('/savings');
    } catch (err) {
        console.error(err);
        res.redirect('/savings');
    }
});

router.delete('/:id', isAuth, async (req, res) => {
    try {
        await Saving.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.redirect('/savings');
    } catch (err) {
        console.error(err);
        res.redirect('/savings');
    }
});

// Saving Plans
router.post('/plan/add', isAuth, async (req, res) => {
    try {
        const { goalName, targetAmount, month } = req.body;
        await SavingPlan.create({ goalName, targetAmount: parseFloat(targetAmount), month, userId: req.user.id });
        res.redirect('/savings');
    } catch (err) {
        console.error(err);
        res.redirect('/savings');
    }
});

router.post('/plan/toggle/:id', isAuth, async (req, res) => {
    try {
        const plan = await SavingPlan.findById(req.params.id);
        if (plan && plan.userId.toString() === req.user.id.toString()) {
            await SavingPlan.findByIdAndUpdate(plan._id, { isCompleted: !plan.isCompleted });
        }
        res.redirect('/savings');
    } catch (err) {
        console.error(err);
        res.redirect('/savings');
    }
});

router.delete('/plan/:id', isAuth, async (req, res) => {
    try {
        await SavingPlan.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.redirect('/savings');
    } catch (err) {
        console.error(err);
        res.redirect('/savings');
    }
});

module.exports = router;
