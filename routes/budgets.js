import express from 'express';
const router = express.Router();
import { Budget, Category } from '../models/index.js';
import { convert } from '../services/currencyService.js';
import { sendBudgetUpdate } from '../services/emailService.js';
import { ensureDefaultCategories } from '../services/categoryService.js';

const isAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/auth/login');

router.get('/', isAuth, async (req, res) => {
    try {
        const userCurrency = req.user.currency || 'USD';

        // Ensure the user has default categories (auto-seeded if missing)
        await ensureDefaultCategories(req.user.id);

        const budgets = await Budget.find({ userId: req.user.id }).populate('categoryId');

        // Parallelize currency conversion for display
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
            $or: [
                { userId: req.user.id },
                { userId: null }
            ]
        }).sort({ name: 1 });

        res.render('budgets/index', {
            title: 'Budgets',
            budgets: processedBudgets,
            categories,
            userCurrency
        });
    } catch (err) {
        console.error('Error fetching budgets:', err);
        res.status(500).send('Internal Server Error');
    }
});

router.post('/add', isAuth, async (req, res) => {
    try {
        const { categoryId, amount, description } = req.body;
        if (!categoryId || !amount) {
            req.flash('error', 'Please select a category and specify an amount.');
            return res.redirect('/budgets');
        }

        const userCurrency = req.user.currency || 'USD';

        // Convert input amount (in user's currency) back to USD for base storage
        const amountInUsd = await convert(parseFloat(amount), userCurrency, 'USD');

        let budget = await Budget.findOne({ userId: req.user.id, categoryId });
        if (budget) {
            budget.amount = amountInUsd;
            budget.description = description;
            await budget.save();
        } else {
            await Budget.create({
                userId: req.user.id,
                categoryId,
                amount: amountInUsd,
                description
            });
        }

        // Send confirmation email if category exists
        const category = await Category.findById(categoryId);
        if (category) {
            await sendBudgetUpdate(req.user.email, category.name, parseFloat(amount), userCurrency);
        }

        req.flash('success', 'Budget saved successfully!');
        res.redirect('/budgets');
    } catch (err) {
        console.error('Error creating budget:', err);
        req.flash('error', 'Failed to save budget.');
        res.redirect('/budgets');
    }
});

router.put('/update', isAuth, async (req, res) => {
    try {
        const { id, categoryId, amount, description } = req.body;
        if (!categoryId || !amount) {
            req.flash('error', 'Please select a category and specify an amount.');
            return res.redirect('/budgets');
        }

        const userCurrency = req.user.currency || 'USD';
        const amountInUsd = await convert(parseFloat(amount), userCurrency, 'USD');

        await Budget.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            { categoryId, amount: amountInUsd, description }
        );

        // Send confirmation email if category exists
        const category = await Category.findById(categoryId);
        if (category) {
            await sendBudgetUpdate(req.user.email, category.name, parseFloat(amount), userCurrency);
        }

        req.flash('success', 'Budget updated successfully!');
        res.redirect('/budgets');
    } catch (err) {
        console.error('Error updating budget:', err);
        req.flash('error', 'Failed to update budget.');
        res.redirect('/budgets');
    }
});

router.delete('/:id', isAuth, async (req, res) => {
    try {
        await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        req.flash('success', 'Budget deleted successfully.');
        res.redirect('/budgets');
    } catch (err) {
        console.error('Error deleting budget:', err);
        res.redirect('/budgets');
    }
});

export default router;
