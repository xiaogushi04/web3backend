import { ethers } from 'ethers';
import config from '../config/config.js';
import contracts from '../config/contracts.js';
import indexerService from './indexer.service.js';
import cacheService from './cache.js';
import logger from '../utils/logger.js';
import NFT from '../models/nft.model.js';

export class ContractService {
    constructor() {
        if (!config.blockchain.rpcUrl) {
            throw new Error('RPC URL 未配置');
        }
        if (!config.blockchain.privateKey) {
            throw new Error('私钥未配置');
        }
        if (!contracts.academicNFT.address) {
            throw new Error('AcademicNFT 合约地址未配置');
        }
        if (!contracts.academicNFT.abi) {
            throw new Error('AcademicNFT ABI 未找到');
        }
        if (!contracts.market.address) {
            throw new Error('Market 合约地址未配置');
        }
        if (!contracts.market.abi) {
            throw new Error('Market ABI 未找到');
        }

        this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
        // 使用环境变量中的私钥创建钱包
        this.wallet = new ethers.Wallet(config.blockchain.privateKey, this.provider);
        
        // 记录钱包地址
        logger.info(`初始化钱包地址: ${this.wallet.address}`);
        
        this.academicNFTContract = new ethers.Contract(
            contracts.academicNFT.address,
            contracts.academicNFT.abi,
            this.wallet
        );
        this.marketContract = new ethers.Contract(
            contracts.market.address,
            contracts.market.abi,
            this.wallet
        );
    }

    async mintResource(to, title, description, ipfsHash, resourceType, authors) {
        try {
            logger.info('开始铸造NFT:', {
                to,
                title,
                description,
                ipfsHash,
                resourceType,
                authors
            });

            // 获取当前区块信息
            const block = await this.provider.getBlock('latest');
            const timestamp = block.timestamp * 1000; // 转换为毫秒

            // 铸造NFT
            const tx = await this.academicNFTContract.mintResource(
                to,
                title,
                description,
                ipfsHash,
                resourceType,
                authors
            );

            logger.info('交易已发送:', tx.hash);
            const receipt = await tx.wait();
            logger.info('交易已确认:', receipt.hash);
            logger.info('交易收据详情:', {
                blockNumber: receipt.blockNumber,
                logs: receipt.logs.map(log => ({
                    topics: log.topics,
                    data: log.data
                }))
            });

            // 从事件中获取tokenId
            let tokenId = null;
            let transferFound = false;
            let resourceMintedFound = false;

            for (const log of receipt.logs) {
                try {
                    logger.info('解析日志:', {
                        topics: log.topics,
                        data: log.data
                    });

                    const parsed = this.academicNFTContract.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });

                    logger.info('解析后的事件:', {
                        name: parsed.name,
                        args: parsed.args.map(arg => arg.toString())
                    });

                    if (parsed.name === 'ResourceMinted' && parsed.args && parsed.args.length >= 1) {
                        tokenId = parsed.args[1].toString(); // 使用tokenId参数
                        resourceMintedFound = true;
                        logger.info(`从ResourceMinted事件获取到tokenId: ${tokenId}, 完整参数:`, parsed.args.map(arg => arg.toString()));
                    } else if (parsed.name === 'Transfer' && parsed.args && parsed.args.length >= 3) {
                        tokenId = parsed.args[2].toString();
                        transferFound = true;
                        logger.info(`从Transfer事件获取到tokenId: ${tokenId}, 完整参数:`, parsed.args.map(arg => arg.toString()));
                    }
                } catch (parseError) {
                    logger.warn(`解析日志失败: ${parseError.message}`, {
                        error: parseError,
                        log: {
                            topics: log.topics,
                            data: log.data
                        }
                    });
                }
            }

            if (!tokenId) {
                throw new Error('未能从交易中获取tokenId');
            }

            logger.info('准备创建NFT记录:', {
                tokenId,
                to,
                title,
                description,
                ipfsHash,
                resourceType,
                authors
            });

            // 创建NFT记录
            const nft = new NFT({
                tokenId: tokenId,
                title,
                description,
                ipfsHash,
                resourceType,
                authors,
                creator: to.toLowerCase(),
                currentOwner: to.toLowerCase(),
                createdAt: new Date(timestamp),
                lastTransferredAt: new Date(timestamp),
                transfers: [{
                    from: ethers.ZeroAddress,
                    to: to.toLowerCase(),
                    timestamp: timestamp,
                    blockNumber: receipt.blockNumber,
                    transactionHash: receipt.hash
                }],
                listing: {
                    active: false,
                    price: '0',
                    seller: null,
                    timestamp: 0
                }
            });

            await nft.save();
            logger.info('NFT记录已保存到数据库');

            // 手动触发索引器同步
            try {
                logger.info('开始手动同步索引器...');
                const currentBlock = await this.provider.getBlockNumber();
                const fromBlock = currentBlock - 1; // 只同步当前区块
                await indexerService.syncSpecificBlockRange(fromBlock, currentBlock);
                logger.info('索引器同步完成');
            } catch (syncError) {
                logger.error('索引器同步失败:', syncError);
                // 不抛出错误，因为NFT已经成功铸造
            }

            logger.info('铸造NFT成功:', {
                tokenId: tokenId,
                transactionHash: receipt.hash,
                block: receipt.blockNumber,
                eventsFound: {
                    transfer: transferFound,
                    resourceMinted: resourceMintedFound
                }
            });

            return {
                success: true,
                tokenId: tokenId,
                transactionHash: receipt.hash,
                block: receipt.blockNumber
            };
        } catch (error) {
            logger.error('铸造NFT失败:', error);
            throw error;
        }
    }

    async createReference(sourceTokenId, targetTokenId, description, senderPrivateKey) {
        try {
            const tx = await this.academicNFTContract.createReference(
                sourceTokenId,
                targetTokenId,
                description
            );
            const receipt = await tx.wait();
            
            // 从事件中获取 referenceId
            let referenceId = 0;
            if (receipt && receipt.logs) {
                // 尝试从日志中解析事件
                try {
                    for (const log of receipt.logs) {
                        // 确保log对象有效
                        if (!log || !log.topics || !log.data) {
                            console.warn('无效的日志对象:', log);
                            continue;
                        }
                        
                        // 尝试解析日志为事件
                        try {
                            const parsed = this.academicNFTContract.interface.parseLog({
                                topics: log.topics,
                                data: log.data
                            });
                            
                            // 找到 ReferenceCreated 事件
                            if (parsed && parsed.name === 'ReferenceCreated' && parsed.args) {
                                // 确保args存在且包含referenceId
                                if (parsed.args.length >= 4) {
                                    referenceId = parsed.args[0]; // 直接使用args[0]
                                } else if (parsed.args.referenceId !== undefined) {
                                    referenceId = parsed.args.referenceId; // 使用命名属性
                                }
                                break;
                            }
                        } catch (parseError) {
                            console.warn('解析单个日志失败:', parseError.message);
                        }
                    }
                } catch (error) {
                    console.warn('解析事件失败:', error);
                }
            }
            
            // 如果无法从事件获取，则返回空值
            await this._syncAfterTransaction();
            
            return {
                success: true,
                referenceId: referenceId ? referenceId.toString() : '0',
                transactionHash: receipt.hash
            };
        } catch (error) {
            console.error('创建引用失败:', error);
            throw error;
        }
    }

    async getReference(referenceId) {
        try {
            const reference = await this.academicNFTContract.getReference(referenceId);
            return {
                sourceTokenId: reference.sourceTokenId.toString(),
                targetTokenId: reference.targetTokenId.toString(),
                description: reference.description,
                timestamp: reference.timestamp.toString()
            };
        } catch (error) {
            console.error('获取引用详情失败:', error);
            throw error;
        }
    }

    async listToken(tokenId, price, signature) {
        try {
            logger.info(`开始上架NFT, tokenId: ${tokenId}, price: ${price}`);
            logger.info(`Market合约地址: ${contracts.market.address}`);
            logger.info(`NFT合约地址: ${contracts.academicNFT.address}`);
            
            // 检查参数
            if (!tokenId || tokenId <= 0) {
                throw new Error('无效的tokenId');
            }
            
            if (!price || price <= 0) {
                throw new Error('无效的价格');
            }

            // 验证签名
            const message = `授权访问资源 ${tokenId}`;
            const recoveredAddress = ethers.verifyMessage(message, signature);
            logger.info(`签名恢复地址: ${recoveredAddress}`);

            // 检查NFT所有权
            try {
                const owner = await this.academicNFTContract.ownerOf(tokenId);
                logger.info(`NFT所有者: ${owner}`);
                
                // 使用签名恢复的地址检查所有权
                if (owner.toLowerCase() !== recoveredAddress.toLowerCase()) {
                    throw new Error('您不是该NFT的所有者，无法上架');
                }
            } catch (error) {
                logger.error(`检查NFT所有权失败: ${error.message}`);
                throw new Error(`检查NFT所有权失败: ${error.message}`);
            }

            // 检查Market合约是否已授权
            try {
                logger.info('开始检查Market合约授权...');
                logger.info(`检查地址: ${recoveredAddress} 是否授权给 ${contracts.market.address}`);
                
                const isApproved = await this.academicNFTContract.isApprovedForAll(
                    recoveredAddress,
                    contracts.market.address
                );
                
                logger.info(`Market合约授权状态: ${isApproved}`);
                
                if (!isApproved) {
                    logger.info('Market合约未授权');
                    return {
                        success: false,
                        message: 'Market合约未授权',
                        data: {
                            marketAddress: contracts.market.address,
                            nftAddress: contracts.academicNFT.address,
                            price: price
                        }
                    };
                }
            } catch (error) {
                logger.error(`检查Market合约授权失败: ${error.message}`);
                throw new Error(`检查Market合约授权失败: ${error.message}`);
            }
            
            // 返回合约地址和参数，让前端直接调用合约
            return {
                success: true,
                data: {
                    marketAddress: contracts.market.address,
                    nftAddress: contracts.academicNFT.address,
                    price: price.toString()
                }
            };
        } catch (error) {
            logger.error('上架 NFT 失败:', error);
            throw error;
        }
    }

    async unlistToken(tokenId, senderPrivateKey) {
        try {
            const tx = await this.academicNFTContract.unlistToken(tokenId);
            const receipt = await tx.wait();
            
            // 交易完成后同步索引器
            await this._syncAfterTransaction();
            
            return {
                success: true,
                transactionHash: receipt.hash
            };
        } catch (error) {
            console.error('下架 NFT 失败:', error);
            throw error;
        }
    }

    async buyToken(tokenId, value, buyerAddress) {
        try {
            logger.info(`购买NFT, tokenId: ${tokenId}, buyer: ${buyerAddress}, price: ${value} wei`);
            
            // 创建合约实例（使用平台钱包，因为需要支付ETH）
            const marketContract = new ethers.Contract(
                contracts.market.address,
                contracts.market.abi,
                this.wallet
            );
            
            // 发送交易
            const tx = await marketContract.buyToken(tokenId, { value });
            const receipt = await tx.wait();
            
            // 手动触发索引器同步
            try {
                logger.info('开始手动同步索引器...');
                const currentBlock = await this.provider.getBlockNumber();
                const fromBlock = currentBlock - 1; // 只同步当前区块
                await indexerService.syncSpecificBlockRange(fromBlock, currentBlock);
                logger.info('索引器同步完成');
            } catch (syncError) {
                logger.error('索引器同步失败:', syncError);
                // 不抛出错误，因为购买已经成功
            }
            
            return {
                success: true,
                transactionHash: receipt.hash
            };
        } catch (error) {
            logger.error('购买 NFT 失败:', error);
            throw error;
        }
    }

    async getListing(tokenId) {
        try {
            const listing = await this.academicNFTContract.getListing(tokenId);
            return {
                seller: listing.seller,
                price: listing.price.toString(),
                isActive: listing.isActive
            };
        } catch (error) {
            console.error('获取上架详情失败:', error);
            throw error;
        }
    }

    // 添加_syncAfterTransaction方法
    async _syncAfterTransaction() {
        try {
            // 清除缓存
            await cacheService.invalidateAllNFTLists();
            
            // 如果启用了索引器，则执行同步
            if (indexerService) {
                logger.info('交易完成，开始同步索引器...');
                const currentBlock = await this.provider.getBlockNumber();
                const fromBlock = currentBlock - 10; // 同步最近10个区块
                await indexerService.syncSpecificBlockRange(fromBlock, currentBlock);
            }
        } catch (error) {
            logger.error('同步索引器失败:', error);
        }
    }

    async getMarketInfo() {
        try {
            logger.info('开始获取市场信息');
            const listings = await NFT.find({ 'listing.active': true })
                .sort({ 'listing.timestamp': -1 });
            logger.info(`找到 ${listings.length} 个上架的NFT`);
            listings.forEach(listing => {
                logger.info(`NFT ${listing.tokenId} 状态: active=${listing.listing.active}, price=${listing.listing.price}`);
            });
            return listings;
        }
        catch (error) {
            logger.error('获取市场信息失败:', error);
            throw error;
        }
    }
} 