import express from 'express';
import { ContractService } from '../services/contract.service.js';
import { verifySignature } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();
const contractService = new ContractService();

// 上架 NFT
router.post('/list', verifySignature, async (req, res) => {
  try {
    const { tokenId, price } = req.body;
    const signature = req.headers['x-signature'];

    const receipt = await contractService.listToken(tokenId, price, signature);
    res.json({ success: true, receipt });
  } catch (error) {
    logger.error('Failed to list NFT:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 购买 NFT
router.post('/buy', verifySignature, async (req, res) => {
  try {
    const { tokenId, price } = req.body;
    const signature = req.headers['x-signature'];

    const receipt = await contractService.buyToken(tokenId, price, signature);
    res.json({ success: true, receipt });
  } catch (error) {
    logger.error('Failed to buy NFT:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 购买资源访问权
router.post('/access/buy', verifySignature, async (req, res) => {
  const { resourceId, duration, maxUses, message, address } = req.body;
  const signature = req.headers['x-signature'];
  const userAddress = req.headers['x-user-address'];

  logger.info(`[MarketRoutes] POST /access/buy - 用户 ${userAddress} 购买访问权: resourceId=${resourceId}, duration=${duration}, maxUses=${maxUses}`);
  
  try {
    // 验证用户地址
    if (!userAddress || userAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: '用户地址验证失败'
      });
    }

    logger.info(`[MarketRoutes] POST /access/buy - 开始调用合约服务...`);
    
    const result = await contractService.buyAccessToken(
      resourceId,
      userAddress,
      duration,
      maxUses,
      signature,
      message
    );

    // 处理成功响应
    if (result && result.success) {
      logger.info(`[MarketRoutes] POST /access/buy - 购买成功: ${JSON.stringify(result)}`);
      return res.json({
        success: true,
        data: {
          accessTokenId: result.accessTokenId,
          transactionHash: result.transactionHash
        }
      });
    } else {
      // 处理未知错误
      logger.error(`[MarketRoutes] POST /access/buy - 未知错误:`, result);
      return res.status(500).json({
        success: false,
        message: '购买访问权失败，未知错误',
        errorDetails: result
      });
    }
  } catch (error) {
    logger.error(`[MarketRoutes] POST /access/buy - 错误:`, error);
    
    // 处理特定错误类型
    if (error.message.startsWith('ACCESS_CONFIG_REQUIRED:') ||
        error.message.startsWith('INSUFFICIENT_FUNDS:') ||
        error.message.startsWith('GAS_LIMIT:') ||
        error.message.startsWith('CONTRACT_ERROR:') ||
        error.message.startsWith('UNKNOWN_ERROR:')) {
      const [errorType, errorMessage] = error.message.split(':');
      return res.status(400).json({
        success: false,
        message: errorMessage,
        errorType: errorType
      });
    }
    
    // 处理其他错误
    return res.status(500).json({
      success: false,
      message: '购买访问权失败',
      error: error.message
    });
  }
});

// 使用访问权
router.post('/access/use', verifySignature, async (req, res) => {
  try {
    const { accessTokenId } = req.body;
    const userAddress = req.userAddress;

    const tx = await contractService.useAccessToken(accessTokenId, userAddress);
    res.json({
      success: true,
      transactionHash: tx.hash
    });
  } catch (error) {
    logger.error('使用访问权失败:', error);
    res.status(500).json({
      success: false,
      message: '使用访问权失败'
    });
  }
});

// 销毁访问权
router.post('/access/burn', verifySignature, async (req, res) => {
  try {
    const { accessTokenId } = req.body;
    const userAddress = req.userAddress;

    const tx = await contractService.burnAccessToken(accessTokenId, userAddress);
    res.json({
      success: true,
      transactionHash: tx.hash
    });
  } catch (error) {
    logger.error('销毁访问权失败:', error);
    res.status(500).json({
      success: false,
      message: '销毁访问权失败'
    });
  }
});

// 获取访问权信息
router.get('/access/:accessTokenId', async (req, res) => {
  try {
    const { accessTokenId } = req.params;
    const accessToken = await contractService.getAccessToken(accessTokenId);
    res.json({
      success: true,
      data: accessToken
    });
  } catch (error) {
    logger.error('获取访问权信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取访问权信息失败'
    });
  }
});

// 获取购买费用明细
router.get('/purchase-breakdown/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const breakdown = await contractService.getPurchaseBreakdown(tokenId);
    res.json({
      success: true,
      data: breakdown
    });
  } catch (error) {
    logger.error('获取购买费用明细失败:', error);
    res.status(500).json({
      success: false,
      message: '获取购买费用明细失败'
    });
  }
});

// 检查访问权限
router.get('/access/check/:resourceId', async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        message: '缺少钱包地址'
      });
    }

    const hasAccess = await contractService.checkAccess(resourceId, address);
    res.json({
      success: true,
      hasAccess
    });
  } catch (error) {
    logger.error('检查访问权限失败:', error);
    res.status(500).json({
      success: false,
      message: '检查访问权限失败'
    });
  }
});

// 获取资源访问权配置
router.get('/access/config/:resourceId', async (req, res) => {
  const { resourceId } = req.params;
  
  logger.info(`[MarketRoutes] GET /access/config/${resourceId} - 获取访问权配置`);
  
  try {
    // 检查资源是否存在
    const isResourceExists = await contractService.isResourceExists(resourceId);
    if (!isResourceExists) {
      logger.warn(`[MarketRoutes] GET /access/config/${resourceId} - 资源不存在`);
      return res.status(404).json({ success: false, message: '资源不存在' });
    }
    
    // 获取访问权配置
    const config = await contractService.getResourceAccessConfig(resourceId);
    logger.info(`[MarketRoutes] GET /access/config/${resourceId} - 成功获取访问权配置: ${JSON.stringify(config)}`);
    
    return res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error(`[MarketRoutes] GET /access/config/${resourceId} - 获取访问权配置失败:`, error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || '获取访问权配置失败',
      error: {
        type: 'SERVER_ERROR',
        details: error.message
      }
    });
  }
});

// 设置资源访问权配置
router.post('/access/config', verifySignature, async (req, res) => {
  const { resourceId, maxTokens, price, isActive } = req.body;
  const userAddress = req.userAddress; // 从中间件获取的已验证地址
  
  logger.info(`[MarketRoutes] POST /access/config - 设置访问权配置: resourceId=${resourceId}, maxTokens=${maxTokens}, price=${price}, isActive=${isActive}, userAddress=${userAddress}`);
  
  try {
    // 设置访问权配置（权限检查在service层处理）
    const result = await contractService.setAccessTokenConfig(resourceId, maxTokens, price, isActive, userAddress);
    logger.info(`[MarketRoutes] POST /access/config - 设置成功: resourceId=${resourceId}`);
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`[MarketRoutes] POST /access/config - 设置访问权配置失败:`, error);
    return res.status(500).json({ success: false, message: `设置访问权配置失败: ${error.message}` });
  }
});

export default router; 