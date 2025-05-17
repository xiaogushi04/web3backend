import { Router } from 'express';
import { ContractService } from '../services/contract.service.js';
import nftService from '../services/nft.service.js';
import ipfsService from '../services/ipfs.js';
import multer from 'multer';
import logger from '../utils/logger.js';
import { ethers } from 'ethers';
import config from '../config/config.js';
import contracts from '../config/contracts.js';

const router = Router();
const contractService = new ContractService();

// 配置 multer 内存存储
const upload = multer({ storage: multer.memoryStorage() });

// 铸造新的学术资源 NFT（包含文件上传）
router.post('/mint-with-file', 
  upload.single('file'),
  async (req, res) => {
    try {
        logger.info('收到 mint-with-file 请求');
        logger.debug('请求头:', req.headers);
        logger.debug('请求体:', req.body);
        logger.debug('文件信息:', req.file ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        } : '无文件');

        if (!req.file) {
            logger.error('未提供文件');
            return res.status(400).json({
                success: false,
                error: '未提供文件'
            });
        }

        const { to, title, description, resourceType, authors } = req.body;
        logger.debug('请求参数:', { to, title, description, resourceType, authors });

        if (!to || !title || !description || !resourceType || !authors) {
            logger.error('缺少必要参数');
            return res.status(400).json({
                success: false,
                error: '缺少必要参数'
            });
        }

        // 上传文件到 IPFS
        logger.info('开始上传文件到 IPFS');
        const { cid } = await ipfsService.uploadFile(req.file.buffer);
        if (!cid) {
            logger.error('IPFS 上传失败，CID 为空');
            return res.status(500).json({ success: false, error: 'IPFS 上传失败，CID 为空' });
        }
        logger.info('文件上传成功，CID:', cid);

        // 开始固定文件
        try {
            await ipfsService.pinFile(cid);
            logger.info('文件固定成功');
        } catch (error) {
            logger.error('文件固定失败:', error);
            return res.status(500).json({ success: false, error: '文件固定失败' });
        }

        // 开始铸造 NFT
        try {
            logger.info('开始铸造 NFT');
            const result = await contractService.mintResource(
                to,
                title,
                description,
                cid,  // 使用 cid 作为 ipfsHash
                parseInt(resourceType),
                JSON.parse(authors)
            );
            logger.info('NFT 铸造成功:', result);

            res.json({ 
                success: true, 
                data: {
                    ...result,
                    ipfsHash: cid  // 确保返回的 ipfsHash 也是 cid
                }
            });
        } catch (error) {
            logger.error('NFT 铸造失败:', error);
            return res.status(500).json({ 
                success: false, 
                error: `NFT 铸造失败: ${error.message}`,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    } catch (error) {
        logger.error('铸造 NFT 失败:', error);
        logger.error('错误堆栈:', error.stack);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 原有的铸造端点保留，用于直接使用 IPFS hash 的情况
router.post('/mint', async (req, res) => {
    try {
        const { to, title, description, ipfsHash, resourceType, authors } = req.body;
        const result = await contractService.mintResource(
            to,
            title,
            description,
            ipfsHash,
            resourceType,
            authors
        );
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取资源元数据
router.get('/resource/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        // 使用NFT服务获取元数据
        const metadata = await nftService.getResourceMetadata(tokenId);
        res.json({ success: true, data: metadata });
    } catch (error) {
        logger.error(`获取资源元数据失败: tokenId=${req.params.tokenId}, error=${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 创建引用
router.post('/reference', async (req, res) => {
    try {
        const { sourceTokenId, targetTokenId, description } = req.body;
        const result = await contractService.createReference(
            Number(sourceTokenId),
            Number(targetTokenId),
            description
        );
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取引用详情
router.get('/reference/:referenceId', async (req, res) => {
    try {
        const { referenceId } = req.params;
        const reference = await contractService.getReference(Number(referenceId));
        res.json({ success: true, data: reference });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 上架 NFT
router.post('/list', async (req, res) => {
    try {
        const { tokenId, price, signature } = req.body;
        logger.info(`收到上架请求: tokenId=${tokenId}, price=${price}, signature=${signature}`);

        // 验证签名
            const message = `授权访问资源 ${tokenId}`;
            const recoveredAddress = ethers.verifyMessage(message, signature);
            
            if (!recoveredAddress) {
            return res.status(401).json({ error: '签名验证失败' });
            }

        // 获取交易数据
        const txData = await nftService.listToken(tokenId, price, recoveredAddress, signature);
        res.json({ 
            success: true,
            data: txData
            });
    } catch (error) {
        logger.error('上架 NFT 失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 购买 NFT
router.post('/buy', async (req, res) => {
    try {
        const { tokenId, price, buyerAddress, signature } = req.body;
        
        if (!buyerAddress) {
            return res.status(400).json({ 
                success: false, 
                error: '缺少买家地址' 
            });
        }

        // 验证签名
        const message = `授权购买NFT ${tokenId}`;
        const recoveredAddress = ethers.verifyMessage(message, signature);
        
        if (recoveredAddress.toLowerCase() !== buyerAddress.toLowerCase()) {
            return res.status(401).json({ 
                success: false, 
                error: '签名验证失败' 
            });
        }

        const parsedTokenId = Number(tokenId);
        logger.info(`购买NFT, tokenId: ${parsedTokenId}, buyer: ${buyerAddress}, value(wei): ${price}`);
        
        const result = await contractService.buyToken(parsedTokenId, price, buyerAddress);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('购买NFT失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取上架详情
router.get('/listing/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        // 使用NFT服务获取上架信息
        const listing = await nftService.getListing(tokenId);
        res.json({ success: true, data: listing });
    } catch (error) {
        logger.error(`获取上架详情失败: tokenId=${req.params.tokenId}, error=${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取所有资源列表
router.get('/resources', async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder || 'desc';
        
        logger.info(`获取资源列表, limit: ${limit}, offset: ${offset}, sortBy: ${sortBy}, sortOrder: ${sortOrder}`);
        
        // 使用NFT服务获取资源列表
        const resources = await nftService.getAllResources(limit, offset, sortBy, sortOrder);
        res.json({ success: true, data: resources });
    } catch (error) {
        logger.error('获取资源列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取用户的资源列表
router.get('/user/:address/resources', async (req, res) => {
    try {
        const { address } = req.params;
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        
        logger.info(`获取用户 ${address} 的资源列表, limit: ${limit}, offset: ${offset}`);
        
        // 使用NFT服务获取用户资源列表
        const resources = await nftService.getUserResources(address, limit, offset);
        res.json({ success: true, data: resources });
    } catch (error) {
        logger.error(`获取用户 ${req.params.address} 的资源列表失败:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取市场上架的资源列表
router.get('/market', async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        
        logger.info(`获取市场列表, limit: ${limit}, offset: ${offset}`);
        
        // 使用NFT服务获取市场资源列表
        const marketResources = await nftService.getMarketResources(limit, offset);
        
        res.json({ 
            success: true, 
            data: marketResources
        });
    } catch (error) {
        logger.error('获取市场列表失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取NFT的转移历史
router.get('/resource/:tokenId/transfers', async (req, res) => {
    try {
        const { tokenId } = req.params;
        logger.info(`获取NFT转移历史: tokenId=${tokenId}`);
        
        // 使用NFT服务获取NFT转移历史
        const transfers = await nftService.getTransferHistory(tokenId);
        res.json({ success: true, data: transfers });
    } catch (error) {
        logger.error(`获取NFT转移历史失败: tokenId=${req.params.tokenId}, error=${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取NFT的引用
router.get('/resource/:tokenId/references', async (req, res) => {
    try {
        const { tokenId } = req.params;
        logger.info(`获取NFT引用: tokenId=${tokenId}`);
        
        // 使用NFT服务获取NFT引用
        const references = await nftService.getReferences(tokenId);
        res.json({ success: true, data: references });
    } catch (error) {
        logger.error(`获取NFT引用失败: tokenId=${req.params.tokenId}, error=${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 下载资源文件
router.get('/resource/:tokenId/download', async (req, res) => {
    try {
        const { tokenId } = req.params;
        // 查询NFT元数据，获取ipfsHash
        const metadata = await nftService.getResourceMetadata(tokenId);
        if (!metadata || !metadata.ipfsHash) {
            return res.status(404).json({ success: false, error: '未找到资源或IPFS哈希' });
        }
        // 从IPFS获取文件
        const fileBuffer = await ipfsService.getFile(metadata.ipfsHash);
        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Disposition', `attachment; filename="${metadata.title || tokenId}"`);
        res.send(fileBuffer);
    } catch (error) {
        logger.error(`下载资源文件失败: tokenId=${req.params.tokenId}, error=${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取用户的交易历史
router.get('/user/:address/transactions', async (req, res) => {
    try {
        const { address } = req.params;
        logger.info(`获取用户交易历史: address=${address}`);
        
        // 使用NFT服务获取用户交易历史
        const transactionData = await nftService.getUserTransactionHistory(address);
        res.json({ success: true, data: transactionData });
    } catch (error) {
        logger.error(`获取用户交易历史失败: address=${req.params.address}, error=${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router; 