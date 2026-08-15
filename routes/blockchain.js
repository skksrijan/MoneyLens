import express from 'express';
const router = express.Router();
import { verifyChain, getAllBlocks, DIFFICULTY } from '../services/blockchainService.js';
import BlockchainBlock from '../models/BlockchainBlock.js';

const isAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/auth/login');

// GET /blockchain — Block Explorer
router.get('/', isAuth, async (req, res) => {
    try {
        const blocks = await getAllBlocks();
        const verifyResult = await verifyChain();
        res.render('blockchain/index', {
            title: 'Blockchain Explorer',
            blocks,
            verifyResult,
            difficulty: DIFFICULTY
        });
    } catch (err) {
        console.error('[Blockchain Route Error]', err);
        res.status(500).send('Blockchain Explorer error: ' + err.message);
    }
});

// GET /blockchain/verify — JSON chain verification endpoint
router.get('/verify', isAuth, async (req, res) => {
    try {
        const result = await verifyChain();
        res.json(result);
    } catch (err) {
        res.status(500).json({ valid: false, reason: err.message });
    }
});

// GET /blockchain/block/:hash — Single block detail (JSON)
router.get('/block/:hash', isAuth, async (req, res) => {
    try {
        const block = await BlockchainBlock.findOne({ hash: req.params.hash });
        if (!block) return res.status(404).json({ error: 'Block not found' });
        res.json(block);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
