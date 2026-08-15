import express from 'express';
const router = express.Router();
import { Category } from '../models/index.js';

// Add custom category
router.post('/add', async (req, res) => {
    const redirectTo = req.body.redirectTo || req.headers.referer || '/transactions';
    try {
        if (!req.user) return res.redirect('/auth/login');

        const { name, type } = req.body;
        if (name && type) {
            await Category.create({
                name: name.trim(),
                type,
                userId: req.user.id
            });
        }

        res.redirect(redirectTo);
    } catch (err) {
        console.error('Error adding category:', err);
        res.redirect(redirectTo);
    }
});

export default router;
