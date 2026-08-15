const express = require('express');
const router = express.Router();
const { Category } = require('../models');

// Add custom category
router.post('/add', async (req, res) => {
    try {
        if (!req.user) return res.redirect('/auth/login');

        const { name, type } = req.body;
        await Category.create({
            name,
            type,
            userId: req.user.id
        });

        res.redirect('/transactions');
    } catch (err) {
        console.error(err);
        res.redirect('/transactions');
    }
});

module.exports = router;
