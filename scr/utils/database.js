const mongoose = require('mongoose');
const { logger } = require('./logger');

class Database {
    static async connect() {
        try {
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                autoIndex: true,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                family: 4
            });
            
            logger.success('MongoDB Ky Saat Bot Connect Ho Gaya Ha');
            
            mongoose.connection.on('error', (err) => {
                logger.error('MongoDB connection error:', err);
            });
            
            mongoose.connection.on('disconnected', () => {
                logger.warn('MongoDB disconnected, again reconnect ho raha haa...');
                setTimeout(() => Database.connect(), 5000);
            });
            
        } catch (error) {
            logger.error('Bot MongoDB Sy Connect Nahi Ho Paraha:', error);
            setTimeout(() => Database.connect(), 5000);
        }
    }
}

module.exports = { Database };
