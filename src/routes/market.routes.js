import express from 'express';
import { verifySignature } from '../middleware/auth.js';
import { ContractService } from '../services/contract.service.js';
import contracts from '../config/contracts.js';
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
    const { accessTokenId, message, address } = req.body;
    const userAddress = req.headers['x-user-address'];
    
    logger.info(`[MarketRoutes] POST /access/use - 用户 ${userAddress} 使用访问权: accessTokenId=${accessTokenId}`);

    // 验证用户地址
    if (!userAddress || userAddress.toLowerCase() !== address.toLowerCase()) {
      logger.warn(`[MarketRoutes] POST /access/use - 用户地址验证失败: ${userAddress} != ${address}`);
      return res.status(400).json({
        success: false,
        message: '用户地址验证失败'
      });
    }

    // 获取访问权元数据
    const metadata = await contractService.accessTokenContract.getAccessMetadata(accessTokenId);
    const resourceId = metadata.resourceId.toString();
    logger.info(`[MarketRoutes] POST /access/use - 访问权元数据: resourceId=${resourceId}, expiryTime=${metadata.expiryTime}, usedCount=${metadata.usedCount}, maxUses=${metadata.maxUses}, isActive=${metadata.isActive}`);
    
    // 验证访问权的有效性
    if (!metadata.isActive) {
      logger.warn(`[MarketRoutes] POST /access/use - 访问权 ${accessTokenId} 已失效`);
      return res.status(400).json({
        success: false,
        message: '访问权已失效'
      });
    }
    
    // 检查是否过期
    const now = Math.floor(Date.now() / 1000);
    logger.info(`[MarketRoutes] POST /access/use - 过期时间检查: now=${now}, expiryTime=${metadata.expiryTime}, 剩余秒数=${Number(metadata.expiryTime) - now}`);
    
    if (Number(metadata.expiryTime) <= now) {
      logger.warn(`[MarketRoutes] POST /access/use - 访问权 ${accessTokenId} 已过期`);
      return res.status(400).json({
        success: false,
        message: '访问权已过期'
      });
    }
    
    // 检查使用次数
    logger.info(`[MarketRoutes] POST /access/use - 使用次数检查: usedCount=${metadata.usedCount}, maxUses=${metadata.maxUses}`);
    
    if (Number(metadata.usedCount) >= Number(metadata.maxUses)) {
      logger.warn(`[MarketRoutes] POST /access/use - 访问权 ${accessTokenId} 使用次数已达上限`);
      return res.status(400).json({
        success: false,
        message: '访问权使用次数已达上限'
      });
    }
    
    // 检查是否是访问权的所有者
    const owner = await contractService.accessTokenContract.ownerOf(accessTokenId);
    logger.info(`[MarketRoutes] POST /access/use - 所有权检查: owner=${owner}, requestUser=${userAddress}`);
    
    if (owner.toLowerCase() !== userAddress.toLowerCase()) {
      logger.warn(`[MarketRoutes] POST /access/use - 用户 ${userAddress} 不是访问权 ${accessTokenId} 的所有者`);
      return res.status(400).json({
        success: false,
        message: '您不是此访问权的所有者'
      });
    }

    // 获取资源内容
    let content;
    try {
      // 从 IPFS 获取真实资源内容
      content = await contractService.getResourceContent(resourceId);
      
      // 添加使用信息
      const timestamp = new Date().toISOString();
      const accessInfo = `\n\n----- 访问信息 -----\n访问时间: ${timestamp}\n访问用户: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}\n访问权ID: ${accessTokenId}\n剩余使用次数: ${Number(metadata.maxUses) - Number(metadata.usedCount) - 1}`;
      content += accessInfo;
      
      logger.info(`[MarketRoutes] POST /access/use - 已获取资源内容，长度: ${content.length}`);
    } catch (error) {
      logger.error(`[MarketRoutes] POST /access/use - 获取资源 ${resourceId} 内容失败:`, error);
      return res.status(500).json({
        success: false,
        message: '获取资源内容失败: ' + error.message
      });
    }

    // 返回合约调用数据和资源内容
    const contractAddress = contractService.accessTokenContract.address || contracts.accessToken.address;
    logger.info(`[MarketRoutes] POST /access/use - 返回数据: contractAddress=${contractAddress}, methodName=useAccessToken, args=[${accessTokenId}]`);
    
    return res.json({
      success: true,
      data: {
        contractAddress,
        abi: contractService.accessTokenContract.interface.format(),
        methodName: 'useAccessToken',
        args: [accessTokenId],
        content
      }
    });
  } catch (error) {
    logger.error(`[MarketRoutes] POST /access/use - 使用访问权失败: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: error.message
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

// 获取用户的访问权列表
router.get('/access-tokens/:userAddress', async (req, res) => {
  try {
    const { userAddress } = req.params;
    logger.info(`[MarketRoutes] GET /access-tokens/${userAddress} - 获取用户访问权列表`);

    // 获取用户的所有访问权 ID
    const tokenIds = await contractService.accessTokenContract.getUserAccessTokens(userAddress);
    logger.info(`[MarketRoutes] 用户 ${userAddress} 的访问权 IDs:`, tokenIds);

    // 获取每个访问权的详细信息
    const accessTokens = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const metadata = await contractService.accessTokenContract.getAccessMetadata(tokenId);
        return {
          tokenId: tokenId.toString(),
          resourceId: metadata.resourceId.toString(),
          accessType: ['Read', 'Write', 'Full'][metadata.accessType],
          expiryTime: new Date(Number(metadata.expiryTime) * 1000),
          maxUses: Number(metadata.maxUses),
          usedCount: Number(metadata.usedCount),
          isActive: metadata.isActive
        };
      })
    );

    logger.info(`[MarketRoutes] 获取到 ${accessTokens.length} 个访问权的详细信息`);
    
    return res.json({
      success: true,
      data: accessTokens
    });
  } catch (error) {
    logger.error('获取用户访问权列表失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取用户访问权列表失败'
    });
  }
});

// 获取资源内容
router.get('/resource/:resourceId/content', verifySignature, async (req, res) => {
  try {
    const { resourceId } = req.params;
    const userAddress = req.headers['x-user-address'];
    
    logger.info(`[MarketRoutes] GET /resource/${resourceId}/content - 获取资源内容`);

    // 验证用户是否有访问权限
    const hasAccess = await contractService.checkAccess(resourceId, userAddress);
    if (!hasAccess) {
      logger.warn(`[MarketRoutes] GET /resource/${resourceId}/content - 用户 ${userAddress} 无访问权限`);
      return res.status(403).json({ success: false, message: '无访问权限' });
    }

    // 获取资源内容
    const content = await contractService.getResourceContent(resourceId);
    logger.info(`[MarketRoutes] GET /resource/${resourceId}/content - 成功获取资源内容`);

    return res.json({
      success: true,
      data: { content }
    });
  } catch (error) {
    logger.error(`[MarketRoutes] GET /resource/${resourceId}/content - 获取资源内容失败:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || '获取资源内容失败'
    });
  }
});

export default router; 