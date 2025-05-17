import { connectDB } from './services/database.js';
import cacheService from './services/cache.js';
import indexerService from './services/indexer.service.js';
import logger from './utils/logger.js';
import config from './config/config.js';

// 处理进程退出信号
process.on('SIGINT', async () => {
    logger.info('接收到 SIGINT 信号，正在优雅地关闭索引器...');
    await shutdownGracefully();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('接收到 SIGTERM 信号，正在优雅地关闭索引器...');
    await shutdownGracefully();
    process.exit(0);
});

// 处理未捕获的异常
process.on('uncaughtException', async (error) => {
    logger.error('未捕获的异常:', error);
    await shutdownGracefully();
    process.exit(1);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', async (reason) => {
    logger.error('未处理的Promise拒绝:', reason);
});

// 优雅地关闭所有服务
async function shutdownGracefully() {
    logger.info('正在停止索引器...');
    await indexerService.stop();
    
    logger.info('正在关闭Redis连接...');
    await cacheService.disconnect().catch(e => logger.error('关闭Redis连接失败:', e));
    
    logger.info('索引器已完全关闭');
}

// 启动索引器
async function startIndexer() {
    try {
        logger.info('正在启动区块链事件索引器...');
        
        // 连接数据库
        logger.info('连接MongoDB...');
        await connectDB();
        
        // 连接Redis
        logger.info('连接Redis...');
        await cacheService.connect();
        
        // 初始化并启动索引器
        logger.info('初始化索引器...');
        const initialized = await indexerService.initialize();
        
        if (!initialized) {
            throw new Error('索引器初始化失败');
        }
        
        logger.info('启动索引器...');
        // 启用历史事件同步
        const started = await indexerService.start(false);
        
        if (!started) {
            throw new Error('索引器启动失败');
        }
        
        logger.info('索引器已成功启动！');
        logger.info('索引器同步间隔为:', config.indexer.syncInterval, 'ms');
    } catch (error) {
        logger.error('启动索引器失败:', error);
        process.exit(1);
    }
}

// 主函数
(async () => {
    await startIndexer();
})(); 