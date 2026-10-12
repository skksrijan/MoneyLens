import express from 'express';
const router = express.Router();
import passport from 'passport';
import { User } from '../models/index.js';
import { ensureDefaultCategories } from '../services/categoryService.js';

// Google OAuth 2.0 Flow
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/auth' }), async (req, res) => {
    if (req.user) {
        await User.findByIdAndUpdate(req.user.id, { isVerified: true });
        await ensureDefaultCategories(req.user.id);
        res.redirect('/');
    } else {
        res.redirect('/auth');
    }
});

export default router;
