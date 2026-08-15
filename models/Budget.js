const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    period: {
        type: String,
        default: 'monthly'
    },
    description: {
        type: String,
        default: ''
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = mongoose.model('Budget', BudgetSchema);
