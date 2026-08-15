const express = require('express');
const router = express.Router();
const { User } = require('../models');

const isAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/auth/login');

// Currency update
router.post('/update-currency', isAuth, async (req, res) => {
    try {
        const { currency } = req.body;
        await User.findByIdAndUpdate(req.user.id, { currency });
        res.redirect(req.get('Referrer') || '/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
});

// Profile page view
router.get('/profile', isAuth, (req, res) => {
    res.render('user/profile', {
        title: 'My Profile',
        user: req.user
    });
});

// Update profile details
router.post('/profile', isAuth, async (req, res) => {
    try {
        const { name, email } = req.body;

        // Basic validation
        if (!name || !email) {
            req.flash('error', 'Name and Email are required');
            return res.redirect('/user/profile');
        }

        await User.findByIdAndUpdate(req.user.id, { name, email: email.toLowerCase() });

        req.flash('success', 'Profile updated successfully');
        res.redirect('/user/profile');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to update profile');
        res.redirect('/user/profile');
    }
});

module.exports = router;
