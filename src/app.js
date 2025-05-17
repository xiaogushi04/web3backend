import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/error.js';
import { requestLogger } from './utils/logger.js';
import logger from './utils/logger.js';
import contractRoutes from './routes/contract.routes.js';
import uploadRoutes from './modules/upload/routes.js';
import config from './config/config.js';
import { connectDB } from './services/database.js';
import cacheService from './services/cache.js';
import indexerService from './services/indexer.service.js';
import { ContractService } from './services/contract.service.js';
import indexerRoutes from './routes/indexer.routes.js';

dotenv.config();

const app = express();
const contractService = new ContractService();

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// 调试中间件
app.use((req, res, next) => {
    logger.debug('收到请求:', {
        method: req.method,
        url: req.url,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        path: req.path,
        params: req.params,
        query: req.query,
        body: req.body,
        headers: req.headers
    });
    next();
});

// 注册路由
logger.info('注册路由: /api/contracts');
app.use('/api/contracts', contractRoutes);
logger.info('注册路由: /api/ipfs');
app.use('/api/ipfs', uploadRoutes);
logger.info('注册路由: /api/indexer');
app.use('/api/indexer', indexerRoutes);

// 添加别名路由，兼容没有/api前缀的情况
logger.info('注册兼容路由: /contracts');
app.use('/contracts', contractRoutes);
logger.info('注册兼容路由: /ipfs');
app.use('/ipfs', uploadRoutes);

// 简单打印路由信息
logger.info('===== 已注册的路由 =====');
logger.info('- /api/contracts/mint-with-file (POST)');
logger.info('- /api/contracts/mint (POST)');
logger.info('- /api/contracts/resource/:tokenId (GET)');
logger.info('- /api/contracts/reference (POST)');
logger.info('- /api/contracts/reference/:referenceId (GET)');
logger.info('- /api/contracts/list (POST)');
logger.info('- /api/contracts/buy (POST)');
logger.info('- /api/contracts/listing/:tokenId (GET)');
logger.info('- /api/contracts/resources (GET)');
logger.info('- /api/contracts/user/:address/resources (GET)');
logger.info('- /api/contracts/market (GET)');
logger.info('- /api/contracts/resource/:tokenId/transfers (GET)');
logger.info('- /api/contracts/resource/:tokenId/references (GET)');
logger.info('- /api/ipfs/file (POST)');
logger.info('===== 路由信息结束 =====');

// 404 处理
app.use((req, res, next) => {
    logger.warn('未找到路由:', {
        method: req.method,
        url: req.url,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        path: req.path
    });
    
    // 确保返回JSON格式的错误信息
    res.status(404).json({
        success: false,
        error: `Cannot ${req.method} ${req.url}`,
        message: '路由不存在'
    });
});

// 错误处理中间件
app.use(errorHandler);

// 错误处理
app.use((err, req, res, next) => {
    logger.error('服务器错误:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });
    res.status(500).json({ 
        success: false, 
        error: 'Something broke!',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 初始化数据库、Redis和索引器
async function initializeServices() {
    try {
        // 连接数据库
        logger.info('连接MongoDB...');
        await connectDB();
        
        // 连接Redis
        logger.info('连接Redis...');
        await cacheService.connect();
        
        // 如果启用了索引器，则初始化并启动
        if (config.indexer.enabled) {
            logger.info('初始化区块链事件索引器...');
            await indexerService.initialize();
            
            // 启动索引器
            logger.info('启动区块链事件索引器...');
            await indexerService.start();
            
            // 设置定期同步
            const syncInterval = config.indexer.syncInterval;
            if (syncInterval > 0) {
                setInterval(async () => {
                    if (!indexerService.isIndexing) {
                        logger.info('执行定期事件同步...');
                        await indexerService.syncHistoricalEvents();
                    }
                }, syncInterval);
            }
        } else {
            logger.info('索引器已禁用，跳过启动');
        }
        
        logger.info('所有服务初始化完成');
    } catch (error) {
        logger.error('初始化服务失败:', error);
        process.exit(1);
    }
}

// 处理优雅关闭
process.on('SIGINT', async () => {
    logger.info('接收到 SIGINT 信号，正在优雅地关闭服务...');
    await shutdownServices();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('接收到 SIGTERM 信号，正在优雅地关闭服务...');
    await shutdownServices();
    process.exit(0);
});

// 关闭所有服务
async function shutdownServices() {
    try {
        if (config.indexer.enabled) {
            logger.info('停止索引器...');
            await indexerService.stop();
        }
        
        logger.info('关闭Redis连接...');
        await cacheService.disconnect().catch(e => logger.error('关闭Redis连接失败:', e));
        
        logger.info('所有服务已关闭');
    } catch (error) {
        logger.error('关闭服务失败:', error);
    }
}

// 启动服务器和初始化服务
const port = config.server.port || 3000;
const server = app.listen(port, async () => {
    logger.info(`服务器启动成功，监听端口 ${port}`);
    await initializeServices();
});

export default app; 