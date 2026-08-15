const mongoose = require('mongoose');

const SavingPlanSchema = new mongoose.Schema({
    goalName: {
        type: String,
        required: true
    },
    targetAmount: {
        type: Number,
        required: true
    },
    isCompleted: {
        type: Boolean,
        default: false
    },
    month: {
        type: String,
        default: null
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = mongoose.model('SavingPlan', SavingPlanSchema);
