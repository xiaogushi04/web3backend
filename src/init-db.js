import { connectDB } from './services/database.js';
import cacheService from './services/cache.js';
import indexerService from './services/indexer.service.js';
import logger from './utils/logger.js';
import NFT from './models/nft.model.js';
import IndexerState from './models/indexer-state.model.js';

// 处理异常和退出
process.on('SIGINT', async () => {
    logger.info('接收到 SIGINT 信号，正在优雅地关闭...');
    await shutdownGracefully();
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    logger.error('未捕获的异常:', error);
    await shutdownGracefully();
    process.exit(1);
});

// 关闭服务
async function shutdownGracefully() {
    logger.info('正在停止索引器...');
    await indexerService.stop();
    
    logger.info('正在关闭Redis连接...');
    await cacheService.disconnect().catch(e => logger.error('关闭Redis连接失败:', e));
    
    logger.info('全部服务已关闭');
}

// 初始化数据库
async function initializeDatabase() {
    try {
        logger.info('开始初始化数据库...');
        
        // 连接数据库
        logger.info('连接MongoDB...');
        await connectDB();
        
        // 连接Redis
        logger.info('连接Redis...');
        await cacheService.connect();
        
        // 清空数据库
        const shouldReset = process.argv.includes('--reset');
        if (shouldReset) {
            logger.info('重置索引器状态...');
            await IndexerState.deleteMany({});
            
            logger.info('清空NFT集合...');
            await NFT.deleteMany({});
            
            logger.info('清空Redis缓存...');
            await cacheService.delByPattern('*');
        }
        
        // 初始化并启动索引器
        logger.info('初始化索引器...');
        const initialized = await indexerService.initialize();
        
        if (!initialized) {
            throw new Error('索引器初始化失败');
        }
        
        // 同步历史数据
        logger.info('开始同步历史数据...');
        await indexerService.syncHistoricalEvents();
        
        logger.info('数据库初始化完成！');
        
        // 关闭连接
        await shutdownGracefully();
        process.exit(0);
    } catch (error) {
        logger.error('初始化数据库失败:', error);
        await shutdownGracefully();
        process.exit(1);
    }
}

// 主函数
(async () => {
    await initializeDatabase();
})(); 