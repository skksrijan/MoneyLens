const mongoose = require('mongoose');

const SavingSchema = new mongoose.Schema({
    source: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true,
        default: 0
    },
    description: {
        type: String,
        default: ''
    },
    isPrimary: {
        type: Boolean,
        default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = mongoose.model('Saving', SavingSchema);
