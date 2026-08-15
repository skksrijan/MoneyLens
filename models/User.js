const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        default: null
    },
    googleId: {
        type: String,
        default: null,
        sparse: true
    },
    profilePic: {
        type: String,
        default: null
    },
    currency: {
        type: String,
        default: 'USD'
    },
    otpCode: {
        type: String,
        default: null
    },
    otpExpiry: {
        type: Date,
        default: null
    },
    isVerified: {
        type: Boolean,
        default: true
    }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

module.exports = mongoose.model('User', UserSchema);
