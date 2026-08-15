const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { User, Category } = require('../models');

router.get('/login', (req, res) => res.render('login', { title: 'Login' }));
router.get('/register', (req, res) => res.render('register', { title: 'Register' }));

// Update Google callback to auto-verify since Google already verified the email
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/auth/login' }), async (req, res) => {
    if (req.user) {
        await User.findByIdAndUpdate(req.user.id, { isVerified: true });
        res.redirect('/dashboard');
    } else {
        res.redirect('/auth/login');
    }
});

// Email service imports
const { sendOTP } = require('../services/emailService');

router.post('/register', async (req, res) => {
    console.log('Register request received for:', req.body.email);
    const { name, email, password } = req.body;
    try {
        let user = await User.findOne({ email: email.toLowerCase() });
        if (user) return res.render('register', { title: 'Register', error: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            isVerified: true // Automatically verify
        });

        // Add default categories immediately
        const defaultCategories = [
            { name: 'Food', type: 'expense' }, { name: 'Rent', type: 'expense' },
            { name: 'Salary', type: 'income' }, { name: 'Investment', type: 'income' },
            { name: 'Shopping', type: 'expense' }, { name: 'Health', type: 'expense' }
        ];
        await Category.insertMany(defaultCategories.map(c => ({ ...c, userId: newUser._id })));

        req.flash('success', 'Registration successful! You can now login.');
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        res.render('register', { title: 'Register', error: 'Something went wrong' });
    }
});

// Email verification routes removed per user request

router.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/auth/login',
    failureFlash: true
}));

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/logout', (req, res) => {
    req.logout((err) => res.redirect('/'));
});

// Forgot Password Flow

router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { title: 'Forgot Password' });
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.render('forgot-password', { title: 'Forgot Password', error: 'User not found' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await User.findByIdAndUpdate(user._id, { otpCode: otp, otpExpiry: expiry });
        await sendOTP(email, otp);

        res.render('verify-otp', { title: 'Verify OTP', email });
    } catch (err) {
        console.error(err);
        res.render('forgot-password', { title: 'Forgot Password', error: 'Failed to send OTP' });
    }
});

router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({
            email: email.toLowerCase(),
            otpCode: otp,
            otpExpiry: { $gt: new Date() }
        });

        if (!user) {
            return res.render('verify-otp', { title: 'Verify OTP', email, error: 'Invalid or expired OTP' });
        }

        res.render('reset-password', { title: 'Reset Password', email, otp });
    } catch (err) {
        res.render('verify-otp', { title: 'Verify OTP', email, error: 'Something went wrong' });
    }
});

router.post('/reset-password', async (req, res) => {
    const { email, otp, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
        return res.render('reset-password', { title: 'Reset Password', email, otp, error: 'Passwords do not match' });
    }

    try {
        const user = await User.findOne({
            email: email.toLowerCase(),
            otpCode: otp,
            otpExpiry: { $gt: new Date() }
        });

        if (!user) return res.redirect('/auth/forgot-password');

        const hashedPassword = await bcrypt.hash(password, 10);
        await User.findByIdAndUpdate(user._id, {
            password: hashedPassword,
            otpCode: null,
            otpExpiry: null,
            isVerified: true
        });

        req.flash('success', 'Password reset successful. Please login.');
        res.redirect('/auth/login');
    } catch (err) {
        res.render('reset-password', { title: 'Reset Password', email, otp, error: 'Failed to reset password' });
    }
});

module.exports = router;
