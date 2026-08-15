const mongoose = require('mongoose');

const BlockchainBlockSchema = new mongoose.Schema({
    index: {
        type: Number,
        required: true,
        unique: true
    },
    timestamp: {
        type: String,
        required: true
    },
    // Snapshot of the transaction data at time of mining
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    // Reference to the actual Transaction document (null for genesis block)
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        default: null
    },
    // Block type: 'genesis' | 'transaction' | 'amendment' | 'deletion'
    eventType: {
        type: String,
        enum: ['genesis', 'transaction', 'amendment', 'deletion'],
        default: 'transaction'
    },
    // For amendment/deletion blocks: hash of the original block being superseded
    amendedBlockHash: {
        type: String,
        default: null
    },
    previousHash: {
        type: String,
        required: true
    },
    hash: {
        type: String,
        required: true,
        unique: true
    },
    nonce: {
        type: Number,
        required: true,
        default: 0
    },
    difficulty: {
        type: Number,
        required: true,
        default: 2
    }
}, { timestamps: true });

module.exports = mongoose.model('BlockchainBlock', BlockchainBlockSchema);

