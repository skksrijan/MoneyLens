const express = require('express');
const router = express.Router();
const { Transaction, Category } = require('../models');
const { convert } = require('../services/currencyService');

const isAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/auth/login');

router.get('/', isAuth, async (req, res) => {
    try {
        const { year } = req.query;
        const currentYear = parseInt(year) || new Date().getFullYear();
        const userCurrency = req.user.currency || 'USD';

        // 1. Fetch current year transactions for category breakdown
        const transactions = await Transaction.find({
            userId: req.user.id,
            date: {
                $gte: `${currentYear}-01-01`,
                $lte: `${currentYear}-12-31`
            }
        }).populate('categoryId');

        let totalIncome = 0;
        let totalExpense = 0;
        // Parallelize conversions for year transactions
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

        // 2. Full Year Monthly Breakdown (Table)
        const fullYearBreakdown = [];
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

        // 3. Last 6 Months Trend (Chart)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

        const trendTransactions = await Transaction.find({
            userId: req.user.id,
            date: { $gte: sixMonthsAgoStr }
        });

        const months = [];
        const monthIncomeTrend = [];
        const monthExpenseTrend = [];

        for (let i = 0; i < 6; i++) {
            const d = new Date();
            d.setMonth(d.getMonth() - (5 - i));
            const mLabel = d.toLocaleString('default', { month: 'short' });
            const yearMonth = d.toISOString().slice(0, 7);

            months.push(mLabel);
            const monthly = trendTransactions.filter(t => t.date.slice(0, 7) === yearMonth);

            let mi = 0, me = 0;
            for (const t of monthly) {
                const convertedAmt = await convert(parseFloat(t.amount), t.currency || 'USD', userCurrency);
                if (t.type === 'income') mi += convertedAmt;
                else me += convertedAmt;
            }
            monthIncomeTrend.push(mi);
            monthExpenseTrend.push(me);
        }

        res.render('reports/index', {
            title: 'Reports',
            totalIncome,
            totalExpense,
            expenseCategories,
            incomeCategories,
            months,
            monthIncome: monthIncomeTrend,
            monthExpense: monthExpenseTrend,
            fullYearBreakdown,
            currentYear,
            userCurrency
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

const { getAnomalies } = require('../services/anomalyService');

router.get('/anomalies', isAuth, async (req, res) => {
    try {
        const anomalies = await getAnomalies(req.user.id);
        const userCurrency = req.user.currency || 'USD';

        res.render('reports/anomalies', {
            title: 'Spending Anomalies',
            anomalies,
            userCurrency
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/anomalies/dismiss/:id', isAuth, async (req, res) => {
    try {
        await Transaction.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { isAnomalyDismissed: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
