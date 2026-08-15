import { Category } from '../models/index.js';

const DEFAULT_CATEGORIES = [
    // Expense categories
    { name: 'Food & Dining', type: 'expense' },
    { name: 'Rent & Housing', type: 'expense' },
    { name: 'Shopping', type: 'expense' },
    { name: 'Health & Medical', type: 'expense' },
    { name: 'Utilities & Bills', type: 'expense' },
    { name: 'Transportation', type: 'expense' },
    { name: 'Entertainment', type: 'expense' },
    { name: 'Groceries', type: 'expense' },
    { name: 'Education', type: 'expense' },
    { name: 'Personal Care', type: 'expense' },
    { name: 'Travel', type: 'expense' },
    { name: 'General Expense', type: 'expense' },
    // Income categories
    { name: 'Salary', type: 'income' },
    { name: 'Investment', type: 'income' },
    { name: 'Freelance / Side Gig', type: 'income' },
    { name: 'Bonus / Gift', type: 'income' },
    { name: 'Other Income', type: 'income' }
];

/**
 * Ensures that the user has default categories available.
 * If the user has no categories (or no expense categories), populates them.
 */
async function ensureDefaultCategories(userId) {
    if (!userId) return;

    try {
        const existingExpenseCount = await Category.countDocuments({
            userId,
            type: 'expense'
        });

        if (existingExpenseCount === 0) {
            const categoriesToInsert = DEFAULT_CATEGORIES.map(cat => ({
                ...cat,
                userId
            }));
            await Category.insertMany(categoriesToInsert, { ordered: false });
        }
    } catch (err) {
        console.error('[CategoryService] Error ensuring default categories:', err.message);
    }
}

export { DEFAULT_CATEGORIES, ensureDefaultCategories };

