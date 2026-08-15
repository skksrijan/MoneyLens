require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/finance_tracker';

const connectDB = async (attempt = 1, maxAttempts = 5) => {
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000
        });
        console.log(`MongoDB connected: ${MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')}`);
    } catch (error) {
        console.error(`MongoDB connection attempt ${attempt} of ${maxAttempts} failed:`, error.message);
        if (attempt < maxAttempts) {
            const delay = 1000 * attempt;
            await new Promise((resolve) => setTimeout(resolve, delay));
            return connectDB(attempt + 1, maxAttempts);
        }
        throw error;
    }
};

module.exports = connectDB;
