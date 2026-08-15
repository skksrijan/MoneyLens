const express = require('express');
const router = express.Router();
const { getAIResponse } = require('../services/aiService');

const isAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/auth/login');

router.get('/', isAuth, (req, res) => {
    res.render('ai/index', {
        title: 'AI Financial Advisor',
        user: req.user
    });
});

router.post('/chat', isAuth, async (req, res) => {
    const { message, history } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        console.log(`Router: Calling AI with message: ${message.substring(0, 20)}...`);
        console.log(`Router: XAI_API_KEY length: ${process.env.XAI_API_KEY ? process.env.XAI_API_KEY.length : 0}`);
        const response = await getAIResponse(req.user.id, message, history || []);
        res.json({ response });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to get AI response' });
    }
});

module.exports = router;
