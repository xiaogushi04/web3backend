import NFT from '../models/nft.model.js';
import cacheService from './cache.js';
import logger from '../utils/logger.js';
import { ethers } from 'ethers';
import config from '../config/config.js';
import contracts from '../config/contracts.js';

class NFTService {
    // 获取所有NFT资源
    async getAllResources(limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc') {
        try {
            // 尝试从缓存获取
            const cacheKey = `nft:list:${limit}:${offset}:${sortBy}:${sortOrder}`;
            const cachedData = await cacheService.getNFTList(cacheKey);
            
            if (cachedData) {
                logger.debug(`从缓存获取NFT列表: ${cacheKey}`);
                return cachedData;
            }
            
            // 确定排序方向
            const sort = {};
            sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
            
            // 查询数据库
            const total = await NFT.countDocuments();
            const resources = await NFT.find()
                .sort(sort)
                .skip(offset)
                .limit(limit)
                .lean();
            
            const result = {
                total,
                resources
            };
            
            // 缓存结果
            await cacheService.cacheNFTList(cacheKey, result, 300); // 缓存5分钟
            
            return result;
        } catch (error) {
            logger.error('获取NFT资源列表失败:', error);
            throw error;
        }
    }
    
    // 获取用户的NFT资源
    async getUserResources(userAddress, limit = 50, offset = 0) {
        try {
            // 强制标准化地址：转换为小写并确保包含0x前缀
            let normalizedAddress = userAddress;
            if (typeof normalizedAddress === 'string') {
                // 确保地址是小写形式
                normalizedAddress = normalizedAddress.toLowerCase();
                
                // 确保有0x前缀
                if (!normalizedAddress.startsWith('0x')) {
                    normalizedAddress = '0x' + normalizedAddress;
                }
            }
            
            logger.info(`获取用户NFT资源，规范化地址: ${normalizedAddress}, 原始地址: ${userAddress}`);
            
            // 尝试从缓存获取
            const cacheKey = `nft:user:${normalizedAddress}:${limit}:${offset}`;
            const cachedData = await cacheService.getNFTList(cacheKey);
            
            if (cachedData) {
                logger.info(`从缓存获取用户NFT列表: ${cacheKey}`);
                return cachedData;
            }
            
            // 查询数据库获取用户拥有的NFT
            logger.info(`开始查询数据库 - 查找拥有者为 ${normalizedAddress} 的NFT`);
            
            // 先获取所有NFT记录，用于调试
            const allNFTs = await NFT.find().lean();
            logger.info(`数据库中共有 ${allNFTs.length} 个NFT记录`);
            allNFTs.forEach(nft => {
                logger.info(`NFT ${nft.tokenId}: owner=${nft.currentOwner}, listing=${nft.listing?.isActive}`);
            });
            
            const total = await NFT.countDocuments({ currentOwner: normalizedAddress });
            logger.info(`找到 ${total} 个拥有者为 ${normalizedAddress} 的NFT`);
            
            const resources = await NFT.find({ currentOwner: normalizedAddress })
                .sort({ lastTransferredAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean();
            
            logger.info(`查询结果: 返回 ${resources.length} 个NFT`);
            resources.forEach(nft => {
                logger.info(`返回的NFT ${nft.tokenId}: owner=${nft.currentOwner}, listing=${nft.listing?.isActive}`);
            });
            
            // 正常的结果
            const result = {
                total,
                resources
            };
            
            // 缓存结果
            await cacheService.cacheNFTList(cacheKey, result, 300);
            
            return result;
        } catch (error) {
            logger.error(`获取用户 ${userAddress} 的NFT资源列表失败:`, error);
            throw error;
        }
    }
    
    // 获取市场上架的NFT资源
    async getMarketResources(limit = 50, offset = 0) {
        try {
            // 尝试从缓存获取
            const cacheKey = `nft:market:${limit}:${offset}`;
            const cachedData = await cacheService.getNFTList(cacheKey);
            
            if (cachedData) {
                logger.debug(`从缓存获取市场NFT列表: ${cacheKey}`);
                return cachedData;
            }
            
            // 查询数据库中上架中的NFT
            const query = {
                'listing.isActive': true,
                'listing.price': { $gt: '0' }
            };
            
            const total = await NFT.countDocuments(query);
            const resources = await NFT.find(query)
                .sort({ 'listing.listedAt': -1 })
                .skip(offset)
                .limit(limit)
                .lean();
            
            logger.info(`查询市场NFT: 总数=${total}, 返回=${resources.length}`);
            
            const result = {
                total,
                resources
            };
            
            // 缓存结果
            await cacheService.cacheNFTList(cacheKey, result, 300); // 缓存5分钟
            
            return result;
        } catch (error) {
            logger.error('获取市场NFT资源列表失败:', error);
            throw error;
        }
    }
    
    // 获取单个NFT资源
    async getResourceMetadata(tokenId) {
        try {
            // 标准化tokenId (移除0x前缀如果存在)
            const normalizeTokenId = (id) => {
                // 如果像是地址格式(0x开头)且长度>10
                if (typeof id === 'string' && id.startsWith('0x') && id.length > 10) {
                    // 尝试转换为数字
                    try {
                        // 检查是否有区块链交易，返回最新的tokenId
                        logger.info(`尝试查找地址 ${id} 的最新NFT`);
                        return null; // 将在后续代码中处理
                    } catch (e) {
                        logger.error(`无法将地址格式的tokenId转换为数字: ${e.message}`);
                        return id;
                    }
                }
                return id.toString();
            };

            const tokenIdStr = normalizeTokenId(tokenId);
            
            // 尝试从缓存获取
            const cacheKey = `nft:${tokenIdStr}:metadata`;
            const cachedData = await cacheService.get(cacheKey);
            
            if (cachedData) {
                logger.debug(`从缓存获取NFT元数据: ${cacheKey}`);
                return JSON.parse(cachedData);
            }
            
            // 查询数据库
            let nft;
            
            // 如果tokenIdStr为null，表示这是地址格式，尝试查找该地址拥有的最新NFT
            if (tokenIdStr === null) {
                const address = tokenId.toLowerCase();
                logger.info(`尝试查找地址 ${address} 的最新NFT`);
                
                // 查找该地址拥有的所有NFT并按创建时间降序排列
                nft = await NFT.findOne({ currentOwner: address })
                    .sort({ createdAt: -1 })
                    .lean();
                    
                if (nft) {
                    logger.info(`找到地址 ${address} 的最新NFT: ${nft.tokenId}`);
                }
            } else {
                // 直接用tokenId查询
                nft = await NFT.findOne({ tokenId: tokenIdStr }).lean();
            }
            
            if (!nft) {
                // 如果没找到，尝试数字格式查询（去掉前导0）
                try {
                    const numericTokenId = tokenId.toString().replace(/^0+/, '');
                    if (numericTokenId !== tokenIdStr) {
                        nft = await NFT.findOne({ tokenId: numericTokenId }).lean();
                        logger.info(`使用数字格式 ${numericTokenId} 找到NFT`);
                    }
                } catch (e) {
                    logger.debug(`尝试数字格式查询失败: ${e.message}`);
                }
            }
            
            if (!nft) {
                throw new Error(`NFT不存在: ${tokenId}`);
            }
            
            // 缓存结果
            await cacheService.set(cacheKey, JSON.stringify(nft), 300); // 缓存5分钟
            
            return nft;
        } catch (error) {
            logger.error(`获取NFT元数据失败: tokenId=${tokenId}, error=${error.message}`);
            throw error;
        }
    }
    
    // 获取NFT的引用
    async getReferences(tokenId) {
        try {
            const tokenIdStr = tokenId.toString();
            
            // 尝试从缓存获取
            const cacheKey = `nft:${tokenIdStr}:references`;
            const cachedData = await cacheService.get(cacheKey);
            
            if (cachedData) {
                logger.debug(`从缓存获取NFT引用: ${cacheKey}`);
                return JSON.parse(cachedData);
            }
            
            // 查询数据库中的引用
            const nft = await NFT.findOne({ tokenId: tokenIdStr }, { references: 1 }).lean();
            
            if (!nft) {
                throw new Error(`NFT不存在: ${tokenIdStr}`);
            }
            
            const references = nft.references || [];
            
            // 缓存结果
            await cacheService.set(cacheKey, JSON.stringify(references), 300); // 缓存5分钟
            
            return references;
        } catch (error) {
            logger.error(`获取NFT引用失败: tokenId=${tokenId}, error=${error.message}`);
            throw error;
        }
    }
    
    // 获取NFT的转移历史
    async getTransferHistory(tokenId) {
        try {
            const tokenIdStr = tokenId.toString();
            
            // 尝试从缓存获取
            const cacheKey = `nft:${tokenIdStr}:transfers`;
            const cachedData = await cacheService.get(cacheKey);
            
            if (cachedData) {
                logger.debug(`从缓存获取NFT转移历史: ${cacheKey}`);
                return JSON.parse(cachedData);
            }
            
            // 查询数据库中的转移历史
            const nft = await NFT.findOne({ tokenId: tokenIdStr }, { transfers: 1 }).lean();
            
            if (!nft) {
                throw new Error(`NFT不存在: ${tokenIdStr}`);
            }
            
            const transfers = nft.transfers || [];
            
            // 缓存结果
            await cacheService.set(cacheKey, JSON.stringify(transfers), 300); // 缓存5分钟
            
            return transfers;
        } catch (error) {
            logger.error(`获取NFT转移历史失败: tokenId=${tokenId}, error=${error.message}`);
            throw error;
        }
    }
    
    // 获取NFT的上架信息
    async getListing(tokenId) {
        try {
            const tokenIdStr = tokenId.toString();
            
            // 尝试从缓存获取
            const cacheKey = `nft:${tokenIdStr}:listing`;
            const cachedData = await cacheService.get(cacheKey);
            
            if (cachedData) {
                logger.debug(`从缓存获取NFT上架信息: ${cacheKey}`);
                return JSON.parse(cachedData);
            }
            
            // 查询数据库中的上架信息
            const nft = await NFT.findOne({ tokenId: tokenIdStr }, { listing: 1 }).lean();
            
            if (!nft) {
                throw new Error(`NFT不存在: ${tokenIdStr}`);
            }
            
            const listing = nft.listing || { isActive: false };
            
            // 缓存结果
            await cacheService.set(cacheKey, JSON.stringify(listing), 300); // 缓存5分钟
            
            return listing;
        } catch (error) {
            logger.error(`获取NFT上架信息失败: tokenId=${tokenId}, error=${error.message}`);
            throw error;
        }
    }

    async listToken(tokenId, price, signerAddress, signature) {
        try {
            logger.info(`开始上架 NFT: tokenId=${tokenId}, price=${price}, signerAddress=${signerAddress}`);
            
            // 确保价格是有效的 wei 值
            const priceInWei = ethers.parseEther(price.toString());
            if (priceInWei <= 0n) {
                throw new Error('价格必须大于0');
            }

            // 使用已初始化的 provider
            const provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl, undefined, {
                timeout: 30000,
                retry: false
            });
            
            // 获取 Market 合约地址
            const marketAddress = contracts.market.address;
            if (!marketAddress) {
                throw new Error('未配置 Market 合约地址');
            }

            // 获取 NFT 合约地址
            const nftAddress = contracts.academicNFT.address;
            if (!nftAddress) {
                throw new Error('未配置 NFT 合约地址');
            }

            // 创建 NFT 合约实例（只读）
            const nftContract = new ethers.Contract(
                nftAddress,
                contracts.academicNFT.abi,
                provider
            );

            // 验证签名者是否是 NFT 所有者
            const owner = await nftContract.ownerOf(tokenId);
            if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
                throw new Error(`签名者 ${signerAddress} 不是 NFT #${tokenId} 的所有者，实际所有者是 ${owner}`);
            }

            // 创建 Market 合约实例
            const marketContract = new ethers.Contract(
                marketAddress,
                contracts.market.abi,
                provider
            );

            // 构建交易数据
            const data = marketContract.interface.encodeFunctionData("listToken", [tokenId, priceInWei]);
            
            // 获取网络信息
            const network = await provider.getNetwork();
            
            // 返回交易数据供前端签名
            return {
                to: marketAddress,
                data: data,
                from: signerAddress,
                value: "0x0",
                gasLimit: "0x493e0", // 300000 in hex
                type: 2, // EIP-1559 transaction
                chainId: network.chainId.toString(),
                maxFeePerGas: (await provider.getFeeData()).maxFeePerGas?.toString() || "0x0",
                maxPriorityFeePerGas: (await provider.getFeeData()).maxPriorityFeePerGas?.toString() || "0x0"
            };
        } catch (error) {
            logger.error('上架 NFT 失败:', error);
            throw error;
        }
    }

    // 获取NFT所有者
    async getResourceOwner(tokenId) {
        try {
            // 标准化tokenId
            const tokenIdStr = tokenId.toString();
            
            // 查询数据库
            const nft = await NFT.findOne({ tokenId: tokenIdStr }).lean();
            
            if (!nft) {
                throw new Error(`NFT不存在: ${tokenId}`);
            }
            
            return nft.currentOwner;
        } catch (error) {
            logger.error(`获取NFT所有者失败: tokenId=${tokenId}, error=${error.message}`);
            throw error;
        }
    }
}

export default new NFTService(); 