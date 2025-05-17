import express from 'express';
import indexerService from '../services/indexer.service.js';
import logger from '../utils/logger.js';

const router = express.Router();

// 手动触发同步
router.post('/sync', async (req, res) => {
    try {
        const { fromBlock, toBlock } = req.body;
        
        if (!fromBlock || !toBlock) {
            return res.status(400).json({
                success: false,
                message: '缺少必要的区块参数'
            });
        }

        logger.info(`开始手动同步区块范围: ${fromBlock}-${toBlock}`);
        
        await indexerService.syncSpecificBlockRange(fromBlock, toBlock);
        
        logger.info('手动同步完成');
        
        res.json({
            success: true,
            message: '同步完成'
        });
    } catch (error) {
        logger.error('手动同步失败:', error);
        res.status(500).json({
            success: false,
            message: '同步失败: ' + error.message
        });
    }
});

export default router; 