const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;

        if (!dbUri) {
            console.error('❌ CRITICAL ERROR: MongoDB connection string is missing!');
            console.error('Please set MONGO_URI in your environment variables (Railway Dashboard > Variables).');
            process.exit(1);
        }

        const conn = await mongoose.connect(dbUri);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
