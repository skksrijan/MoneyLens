require('dotenv').config();
const connectDB = require('./config/db');

(async () => {
    try {
        await connectDB();
        console.log('MongoDB connection successful!');
        process.exit(0);
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }
})();
