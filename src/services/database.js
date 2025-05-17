import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import config from '../config/config.js';

// MongoDB连接
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.database.mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            retryWrites: true,
            w: 'majority',
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        
        logger.info(`MongoDB 已连接: ${conn.connection.host}`);
        
        // 验证写入权限
        try {
            const testCollection = conn.connection.db.collection('test_write');
            await testCollection.insertOne({ test: true });
            await testCollection.deleteOne({ test: true });
            logger.info('MongoDB 写入权限验证成功');
        } catch (writeError) {
            logger.error(`MongoDB 写入权限验证失败: ${writeError.message}`);
            throw writeError;
        }
        
        return conn;
    } catch (error) {
        logger.error(`MongoDB 连接错误: ${error.message}`);
        process.exit(1);
    }
};

// 断开连接
const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        logger.info('MongoDB 连接已关闭');
    } catch (error) {
        logger.error(`MongoDB 断开连接错误: ${error.message}`);
    }
};

export { connectDB, disconnectDB }; 