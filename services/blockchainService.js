const crypto = require('crypto');
const BlockchainBlock = require('../models/BlockchainBlock');

// Mining difficulty: hash must start with this many zeros
const DIFFICULTY = parseInt(process.env.BLOCKCHAIN_DIFFICULTY) || 2;

/**
 * Calculate SHA-256 hash of block contents
 */
function calculateHash(index, timestamp, data, previousHash, nonce) {
    const content = `${index}${timestamp}${JSON.stringify(data)}${previousHash}${nonce}`;
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Mine a block: find a nonce such that the hash starts with DIFFICULTY zeros
 */
function mineBlock(index, timestamp, data, previousHash) {
    let nonce = 0;
    let hash = '';
    const target = '0'.repeat(DIFFICULTY);

    do {
        nonce++;
        hash = calculateHash(index, timestamp, data, previousHash, nonce);
    } while (!hash.startsWith(target));

    return { hash, nonce };
}

/**
 * Get the latest block from MongoDB
 */
async function getLatestBlock() {
    return BlockchainBlock.findOne().sort({ index: -1 });
}

/**
 * Initialize the blockchain: create genesis block if chain is empty
 */
async function initBlockchain() {
    const count = await BlockchainBlock.countDocuments();
    if (count === 0) {
        console.log('[Blockchain] No chain found — creating Genesis Block...');
        const timestamp = new Date().toISOString();
        const data = { message: 'Genesis Block — FinanceTracker Blockchain Initialized' };
        const previousHash = '0'.repeat(64);
        const { hash, nonce } = mineBlock(0, timestamp, data, previousHash);

        await BlockchainBlock.create({
            index: 0,
            timestamp,
            data,
            transactionId: null,
            eventType: 'genesis',
            previousHash,
            hash,
            nonce,
            difficulty: DIFFICULTY
        });
        console.log(`[Blockchain] Genesis Block created — Hash: ${hash.substring(0, 16)}...`);
    } else {
        console.log(`[Blockchain] Chain loaded — ${count} block(s) on chain.`);
    }
}

/**
 * Add a new transaction as a block on the chain.
 * Returns the created block.
 */
async function addTransactionBlock(transaction) {
    const latest = await getLatestBlock();
    if (!latest) {
        throw new Error('Blockchain not initialized. Call initBlockchain() first.');
    }

    const index = latest.index + 1;
    const timestamp = new Date().toISOString();
    const data = {
        transactionId: transaction._id.toString(),
        amount: transaction.amount,
        currency: transaction.currency || 'USD',
        type: transaction.type,
        description: transaction.description || '',
        date: transaction.date,
        userId: transaction.userId.toString()
    };
    const previousHash = latest.hash;

    const { hash, nonce } = mineBlock(index, timestamp, data, previousHash);

    const block = await BlockchainBlock.create({
        index,
        timestamp,
        data,
        transactionId: transaction._id,
        eventType: 'transaction',
        previousHash,
        hash,
        nonce,
        difficulty: DIFFICULTY
    });

    console.log(`[Blockchain] Block #${index} mined — Hash: ${hash.substring(0, 16)}... (nonce: ${nonce})`);
    return block;
}

/**
 * Add an AMENDMENT block when a transaction is edited via the website.
 * Records before/after snapshot. Original block is untouched — the chain stays valid.
 * @param {Object} oldTransaction - The transaction document BEFORE the edit (fetched before update)
 * @param {Object} newData        - The new field values being applied
 * @param {String} originalBlockHash - Hash of the original block being amended
 */
async function addAmendmentBlock(oldTransaction, newData, originalBlockHash) {
    const latest = await getLatestBlock();
    if (!latest) throw new Error('Blockchain not initialized.');

    const index = latest.index + 1;
    const timestamp = new Date().toISOString();
    const data = {
        eventType: 'AMENDMENT',
        transactionId: oldTransaction._id.toString(),
        userId: oldTransaction.userId.toString(),
        amendedBlockHash: originalBlockHash || null,
        // Full before/after snapshot for audit trail
        before: {
            amount:      oldTransaction.amount,
            currency:    oldTransaction.currency || 'USD',
            type:        oldTransaction.type,
            description: oldTransaction.description || '',
            date:        oldTransaction.date,
        },
        after: {
            amount:      parseFloat(newData.amount),
            currency:    newData.currency || 'USD',
            type:        newData.type,
            description: newData.description || '',
            date:        newData.date,
        }
    };
    const previousHash = latest.hash;
    const { hash, nonce } = mineBlock(index, timestamp, data, previousHash);

    const block = await BlockchainBlock.create({
        index,
        timestamp,
        data,
        transactionId: oldTransaction._id,
        eventType: 'amendment',
        amendedBlockHash: originalBlockHash || null,
        previousHash,
        hash,
        nonce,
        difficulty: DIFFICULTY
    });

    console.log(`[Blockchain] Amendment Block #${index} mined for tx ${oldTransaction._id} — nonce: ${nonce}`);
    return block;
}

/**
 * Add a DELETION block when a transaction is deleted via the website.
 * Records the deleted transaction snapshot permanently.
 * @param {Object} transaction - The transaction document being deleted
 * @param {String} originalBlockHash - Hash of the original block for this transaction
 */
async function addDeletionBlock(transaction, originalBlockHash) {
    const latest = await getLatestBlock();
    if (!latest) throw new Error('Blockchain not initialized.');

    const index = latest.index + 1;
    const timestamp = new Date().toISOString();
    const data = {
        eventType: 'DELETION',
        transactionId: transaction._id.toString(),
        userId: transaction.userId.toString(),
        amendedBlockHash: originalBlockHash || null,
        deletedSnapshot: {
            amount:      transaction.amount,
            currency:    transaction.currency || 'USD',
            type:        transaction.type,
            description: transaction.description || '',
            date:        transaction.date,
        }
    };
    const previousHash = latest.hash;
    const { hash, nonce } = mineBlock(index, timestamp, data, previousHash);

    const block = await BlockchainBlock.create({
        index,
        timestamp,
        data,
        transactionId: transaction._id,
        eventType: 'deletion',
        amendedBlockHash: originalBlockHash || null,
        previousHash,
        hash,
        nonce,
        difficulty: DIFFICULTY
    });

    console.log(`[Blockchain] Deletion Block #${index} mined for tx ${transaction._id} — nonce: ${nonce}`);
    return block;
}

/**
 * Verify the integrity of the entire chain.
 * Returns { valid: true, blockCount: N } or { valid: false, invalidAt: index, reason: '...' }
 */
async function verifyChain() {
    const blocks = await BlockchainBlock.find().sort({ index: 1 });

    if (blocks.length === 0) {
        return { valid: false, blockCount: 0, reason: 'Chain is empty' };
    }

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        // Recalculate hash and compare
        const recalculated = calculateHash(
            block.index,
            block.timestamp,
            block.data,
            block.previousHash,
            block.nonce
        );

        if (recalculated !== block.hash) {
            return {
                valid: false,
                blockCount: blocks.length,
                invalidAt: block.index,
                reason: `Hash mismatch at block #${block.index} — data may have been tampered with.`
            };
        }

        // Check chain linkage (skip genesis)
        if (i > 0) {
            const prevBlock = blocks[i - 1];
            if (block.previousHash !== prevBlock.hash) {
                return {
                    valid: false,
                    blockCount: blocks.length,
                    invalidAt: block.index,
                    reason: `Chain broken between block #${i - 1} and #${block.index} — previousHash mismatch.`
                };
            }
        }
    }

    return { valid: true, blockCount: blocks.length };
}

/**
 * Get all blocks, newest first (for explorer display)
 */
async function getAllBlocks() {
    return BlockchainBlock.find().sort({ index: -1 });
}

module.exports = {
    initBlockchain,
    addTransactionBlock,
    addAmendmentBlock,
    addDeletionBlock,
    verifyChain,
    getAllBlocks,
    getLatestBlock,
    DIFFICULTY
};
