const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'USD'
    },
    type: {
        type: String,
        enum: ['income', 'expense'],
        required: true
    },
    date: {
        type: String, // stored as YYYY-MM-DD string to match existing logic
        required: true,
        default: () => new Date().toISOString().split('T')[0]
    },
    description: {
        type: String,
        default: ''
    },
    receiptUrl: {
        type: String,
        default: null
    },
    isAnomalyDismissed: {
        type: Boolean,
        default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    blockHash: {
        type: String,
        default: null
    }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = mongoose.model('Transaction', TransactionSchema);
