import { ethers } from 'ethers';
import config from '../config/config.js';
import contracts from '../config/contracts.js';
import indexerService from './indexer.service.js';
import cacheService from './cache.js';
import logger from '../utils/logger.js';
import NFT from '../models/nft.model.js';
import AcademicNFT from '../../artifacts/src/contracts/AcademicNFT.sol/AcademicNFT.json' assert { type: 'json' };
import Market from '../../artifacts/src/contracts/Market.sol/AcademicMarket.json' assert { type: 'json' };
import AccessToken from '../../artifacts/src/contracts/AccessToken.sol/AccessToken.json' assert { type: 'json' };

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
        this.accessTokenContract = new ethers.Contract(
            contracts.accessToken.address,
            contracts.accessToken.abi,
            this.wallet
        );

        // 添加合约地址日志
        logger.info('合约初始化完成:');
        logger.info(`NFT合约地址: ${contracts.academicNFT.address}`);
        logger.info(`Market合约地址: ${contracts.market.address}`);
        logger.info(`AccessToken合约地址: ${contracts.accessToken.address}`);
        logger.info(`Provider URL: ${config.blockchain.rpcUrl}`);
        logger.info(`Wallet地址: ${this.wallet.address}`);

        // 添加事件处理跟踪
        this.processedEvents = new Set();
        
        // 设置事件监听
        this._setupEventListeners();
    }

    // 设置事件监听
    _setupEventListeners() {
        logger.info('开始设置事件监听...');

        // 移除所有现有的事件监听器
        this.marketContract.removeAllListeners('TokenSold');
        this.marketContract.removeAllListeners('TokenListed');
        this.marketContract.removeAllListeners('RoyaltyPaid');
        this.marketContract.removeAllListeners('AccessTokenSold');

        // 监听 TokenListed 事件
        this.marketContract.on('TokenListed', async (tokenId, seller, price, event) => {
            try {
                // 等待交易确认
                if (!event.transactionHash) {
                    logger.info('等待交易确认...');
                    return;
                }

                // 生成事件唯一ID
                const eventId = `${event.transactionHash}-${event.logIndex}`;
                
                // 检查是否已处理过该事件
                if (this.processedEvents.has(eventId)) {
                    logger.info(`TokenListed事件已处理过: ${eventId}`);
                    return;
                }
                
                // 记录事件ID
                this.processedEvents.add(eventId);
                
                // 等待交易确认
                const receipt = await this.provider.waitForTransaction(event.transactionHash);
                if (!receipt || receipt.status !== 1) {
                    logger.error(`交易失败: ${event.transactionHash}`);
                    return;
                }

                logger.info('检测到 TokenListed 事件:');
                logger.info(`TokenId: ${tokenId.toString()}`);
                logger.info(`Seller: ${seller}`);
                logger.info(`Price: ${ethers.formatEther(price)} ETH`);
                logger.info(`Transaction Hash: ${event.transactionHash}`);
                logger.info(`Block Number: ${receipt.blockNumber}`);
                logger.info(`Event ID: ${eventId}`);
                logger.info(`Gas使用: ${receipt.gasUsed.toString()}`);

                // 更新数据库中的NFT状态
                try {
                    const nft = await NFT.findOne({ tokenId: tokenId.toString() });
                    if (nft) {
                        // 检查NFT当前状态
                        const currentListing = await this.marketContract.listings(tokenId);
                        if (!currentListing.isActive) {
                            logger.warn(`NFT ${tokenId} 当前未上架，跳过更新`);
                            return;
                        }

                        nft.listing = {
                            active: true,
                            price: price.toString(),
                            seller: seller.toLowerCase(),
                            timestamp: Date.now(),
                            transactionHash: event.transactionHash,
                            blockNumber: receipt.blockNumber
                        };
                        await nft.save();
                        logger.info(`NFT ${tokenId} 上架状态已更新`);
                    } else {
                        logger.warn(`未找到NFT ${tokenId} 的记录`);
                    }
                } catch (dbError) {
                    logger.error(`更新NFT上架状态失败: ${dbError.message}`);
                }
            } catch (error) {
                logger.error(`处理TokenListed事件时出错: ${error.message}`);
            }
        });

        // 监听 TokenSold 事件
        this.marketContract.on('TokenSold', async (tokenId, seller, buyer, price, event) => {
            try {
                // 等待交易确认
                if (!event.transactionHash) {
                    logger.info('等待交易确认...');
                    return;
                }

                // 生成事件唯一ID
                const eventId = `${event.transactionHash}-${event.logIndex}`;
                
                // 检查是否已处理过该事件
                if (this.processedEvents.has(eventId)) {
                    logger.info(`TokenSold事件已处理过: ${eventId}`);
                    return;
                }
                
                // 记录事件ID
                this.processedEvents.add(eventId);
                
                // 等待交易确认
                const receipt = await this.provider.waitForTransaction(event.transactionHash);
                if (!receipt || receipt.status !== 1) {
                    logger.error(`交易失败: ${event.transactionHash}`);
                    return;
                }

                logger.info('检测到 TokenSold 事件:');
                logger.info(`TokenId: ${tokenId.toString()}`);
                logger.info(`Seller: ${seller}`);
                logger.info(`Buyer: ${buyer}`);
                logger.info(`Price: ${ethers.formatEther(price)} ETH`);
                logger.info(`Transaction Hash: ${event.transactionHash}`);
                logger.info(`Block Number: ${receipt.blockNumber}`);
                logger.info(`Event ID: ${eventId}`);
                logger.info(`Gas使用: ${receipt.gasUsed.toString()}`);

                // 更新数据库中的NFT状态
                try {
                    const nft = await NFT.findOne({ tokenId: tokenId.toString() });
                    if (nft) {
                        nft.listing = {
                            active: false,
                            price: '0',
                            seller: null,
                            timestamp: Date.now()
                        };
                        nft.currentOwner = buyer.toLowerCase();
                        nft.transfers.push({
                            from: seller.toLowerCase(),
                            to: buyer.toLowerCase(),
                            timestamp: Date.now(),
                            blockNumber: receipt.blockNumber,
                            transactionHash: event.transactionHash
                        });
                        await nft.save();
                        logger.info(`NFT ${tokenId} 销售状态已更新`);
                    } else {
                        logger.warn(`未找到NFT ${tokenId} 的记录`);
                    }
                } catch (dbError) {
                    logger.error(`更新NFT销售状态失败: ${dbError.message}`);
                }
            } catch (error) {
                logger.error(`处理TokenSold事件时出错: ${error.message}`);
            }
        });

        // 监听 RoyaltyPaid 事件
        this.marketContract.on('RoyaltyPaid', async (tokenId, creator, amount, event) => {
            try {
                // 等待交易确认
                if (!event.transactionHash) {
                    logger.info('等待交易确认...');
                    return;
                }

                // 生成事件唯一ID
                const eventId = `${event.transactionHash}-${event.logIndex}`;
                
                // 检查是否已处理过该事件
                if (this.processedEvents.has(eventId)) {
                    logger.info(`RoyaltyPaid事件已处理过: ${eventId}`);
                    return;
                }
                
                // 记录事件ID
                this.processedEvents.add(eventId);
                
                // 等待交易确认
                const receipt = await this.provider.waitForTransaction(event.transactionHash);
                if (!receipt || receipt.status !== 1) {
                    logger.error(`交易失败: ${event.transactionHash}`);
                    return;
                }

                logger.info('检测到 RoyaltyPaid 事件:');
                logger.info(`TokenId: ${tokenId.toString()}`);
                logger.info(`Creator: ${creator}`);
                logger.info(`Amount: ${ethers.formatEther(amount)} ETH`);
                logger.info(`Transaction Hash: ${event.transactionHash}`);
                logger.info(`Block Number: ${receipt.blockNumber}`);
                logger.info(`Event ID: ${eventId}`);
                logger.info(`Gas使用: ${receipt.gasUsed.toString()}`);
            } catch (error) {
                logger.error(`处理RoyaltyPaid事件时出错: ${error.message}`);
            }
        });

        // 监听 AccessTokenSold 事件
        this.marketContract.on('AccessTokenSold', async (resourceId, buyer, accessTokenId, price, event) => {
            try {
                const eventId = `${event.transactionHash}-${event.logIndex}`;
                if (this.processedEvents.has(eventId)) {
                    logger.info('AccessTokenSold event already processed:', eventId);
                    return;
                }

                logger.info('AccessTokenSold event detected:', {
                    resourceId: resourceId.toString(),
                    buyer,
                    accessTokenId: accessTokenId.toString(),
                    price: ethers.formatEther(price),
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });

                // 等待交易确认
                const receipt = await event.getTransactionReceipt();
                if (receipt.status === 0) {
                    logger.error('Transaction failed:', event.transactionHash);
                    return;
                }

                this.processedEvents.add(eventId);
            } catch (error) {
                logger.error('Error processing AccessTokenSold event:', error);
            }
        });

        logger.info('事件监听设置完成');
    }

    async mintResource(to, title, description, ipfsHash, resourceType, authors, royaltyPercentage = 5) {
        try {
            logger.info('开始铸造NFT:', {
                to,
                title,
                description,
                ipfsHash,
                resourceType,
                authors,
                royaltyPercentage
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

            // 检查数据库中是否已存在该 tokenId
            const existingNFT = await NFT.findOne({ tokenId: tokenId });
            if (existingNFT) {
                logger.warn(`TokenId ${tokenId} 已存在于数据库中，跳过创建新记录`);
                return {
                    success: true,
                    tokenId: tokenId,
                    transactionHash: receipt.hash,
                    block: receipt.blockNumber,
                    royaltyPercentage: royaltyPercentage,
                    message: 'NFT已存在'
                };
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

            // 设置版税
            try {
                const marketContract = new ethers.Contract(
                    contracts.market.address,
                    contracts.market.abi,
                    this.wallet
                );
                
                const setRoyaltyTx = await marketContract.setCustomRoyaltyPercentage(
                    tokenId,
                    royaltyPercentage
                );
                await setRoyaltyTx.wait();
                logger.info(`设置版税成功: ${royaltyPercentage}%`);
            } catch (royaltyError) {
                logger.error('设置版税失败:', royaltyError);
                // 不抛出错误，因为NFT已经成功铸造
            }

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
                },
                royaltyPercentage: royaltyPercentage // 添加版税信息
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
                block: receipt.blockNumber,
                royaltyPercentage: royaltyPercentage
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
            logger.info('开始上架NFT...');
            logger.info(`TokenId: ${tokenId}`);
            logger.info(`Price: ${price} ETH`);
            logger.info(`Signature: ${signature}`);

            // 检查 tokenId 是否存在
            try {
                const totalSupply = await this.academicNFTContract.totalResources();
                logger.info(`当前NFT总数: ${totalSupply}`);
                
                if (BigInt(tokenId) > BigInt(totalSupply)) {
                    logger.error(`TokenId ${tokenId} 不存在，当前最大 tokenId 为 ${totalSupply}`);
                    return {
                        success: false,
                        message: 'NFT不存在'
                    };
                }
            } catch (error) {
                logger.error(`检查NFT存在性失败: ${error.message}`);
                throw new Error(`检查NFT存在性失败: ${error.message}`);
            }

            // 验证签名
            const message = `List token ${tokenId} for ${price} ETH`;
            const recoveredAddress = ethers.verifyMessage(message, signature);
            logger.info(`签名验证成功，恢复的地址: ${recoveredAddress}`);

            // 检查NFT所有权
            try {
                logger.info('检查NFT所有权...');
                const owner = await this.academicNFTContract.ownerOf(tokenId);
                logger.info(`NFT当前所有者: ${owner}`);
                
                if (owner.toLowerCase() !== recoveredAddress.toLowerCase()) {
                    logger.error(`NFT所有权验证失败: 当前所有者=${owner}, 签名地址=${recoveredAddress}`);
                    return {
                        success: false,
                        message: '您不是该NFT的所有者'
                    };
                }
            } catch (error) {
                logger.error(`检查NFT所有权失败: ${error.message}`);
                throw new Error(`检查NFT所有权失败: ${error.message}`);
            }

            // 检查Market合约是否已授权
            try {
                logger.info('开始检查Market合约授权...');
                const isApproved = await this.academicNFTContract.isApprovedForAll(
                    recoveredAddress,
                    contracts.market.address
                );
                
                logger.info(`Market合约授权状态: ${isApproved}`);
                
                if (!isApproved) {
                    logger.info('Market合约未授权，需要用户授权');
                    return {
                        success: false,
                        message: 'Market合约未授权',
                        data: {
                            marketAddress: contracts.market.address,
                            nftAddress: contracts.academicNFT.address,
                            price: price.toString()
                        }
                    };
                }
            } catch (error) {
                logger.error(`检查Market合约授权失败: ${error.message}`);
                throw new Error(`检查Market合约授权失败: ${error.message}`);
            }
            
            // 检查NFT是否已经上架
            try {
                logger.info('检查NFT上架状态...');
                const listing = await this.marketContract.listings(tokenId);
                const listingPrice = ethers.formatEther(listing.price);
                logger.info(`NFT当前上架状态:`, {
                    seller: listing.seller,
                    price: listingPrice,
                    isActive: listing.isActive
                });

                if (listing.isActive) {
                    logger.info('NFT已经上架');
                    return {
                        success: false,
                        message: 'NFT已经上架'
                    };
                }
            } catch (error) {
                logger.error(`检查NFT上架状态失败: ${error.message}`);
                throw new Error(`检查NFT上架状态失败: ${error.message}`);
            }
            
            logger.info('上架NFT成功，返回合约信息');
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

    async buyToken(tokenId, price, signature) {
        try {
            logger.info('开始购买NFT...');
            logger.info(`TokenId: ${tokenId}`);
            logger.info(`Price: ${price} ETH`);
            logger.info(`Signature: ${signature}`);
            
            // 验证签名
            const message = `Buy token ${tokenId} for ${price} ETH`;
            const recoveredAddress = ethers.verifyMessage(message, signature);
            logger.info(`签名验证成功，恢复的地址: ${recoveredAddress}`);
            
            // 检查NFT是否已上架
            try {
                logger.info('检查NFT上架状态...');
                const listing = await this.marketContract.listings(tokenId);
                logger.info(`NFT上架信息:`, {
                    seller: listing.seller,
                    price: ethers.formatEther(listing.price),
                    isActive: listing.isActive
                });

                if (!listing.isActive) {
                    logger.info('NFT未上架或已售出');
                    return {
                        success: false,
                        message: 'NFT未上架或已售出'
                    };
                }

                if (listing.price.toString() !== price) {
                    logger.info(`价格不匹配: 上架价格=${ethers.formatEther(listing.price)} ETH, 出价=${price} ETH`);
                    return {
                        success: false,
                        message: '价格不匹配'
                    };
                }
            } catch (error) {
                logger.error(`检查NFT上架状态失败: ${error.message}`);
                throw new Error(`检查NFT上架状态失败: ${error.message}`);
            }

            logger.info('购买NFT成功，返回合约信息');
            return {
                success: true,
                data: {
                    marketAddress: contracts.market.address,
                    tokenId: tokenId,
                    price: price.toString()
                }
            };
        } catch (error) {
            logger.error('购买 NFT 失败:', error);
            throw error;
        }
    }

    async getListing(tokenId) {
        try {
            const listing = await this.marketContract.getListing(tokenId);
            return {
                seller: listing.seller,
                price: listing.price.toString(),
                isActive: listing.isActive
            };
        } catch (error) {
            logger.error('获取上架详情失败:', error);
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

    // 获取购买费用明细
    async getPurchaseBreakdown(tokenId) {
        try {
            const listing = await this.getListing(tokenId);
            if (!listing || !listing.isActive) {
                throw new Error('资源未上架');
            }

            const price = BigInt(listing.price);
            const platformFeePercentage = BigInt(2); // 2%
            const royaltyPercentage = BigInt(await this.getRoyaltyPercentage(tokenId));

            const platformFee = (price * platformFeePercentage) / BigInt(100);
            const royaltyFee = (price * royaltyPercentage) / BigInt(100);
            const sellerReceives = price - platformFee - royaltyFee;

            const creator = await this.getCreator(tokenId);

            return {
                totalPrice: price.toString(),
                platformFee: platformFee.toString(),
                royaltyFee: royaltyFee.toString(),
                sellerReceives: sellerReceives.toString(),
                creator: creator,
                platformFeePercentage: 2,
                royaltyPercentage: Number(royaltyPercentage)
            };
        } catch (error) {
            logger.error('获取购买费用明细失败:', error);
            throw error;
        }
    }

    async buyAccessToken(resourceId, userAddress, duration, maxUses, signature, message) {
        logger.info(`[ContractService] buyAccessToken: Entering - resourceId: ${resourceId}, userAddress: ${userAddress}, duration: ${duration}, maxUses: ${maxUses}`);
        try {
            // 检查AccessToken合约的所有者
            const accessTokenOwner = await this.accessTokenContract.owner();
            logger.info(`[ContractService] buyAccessToken: AccessToken contract owner: ${accessTokenOwner}`);
            logger.info(`[ContractService] buyAccessToken: Market contract address: ${this.marketContract.address}`);

            // 验证签名
            const expectedMessage = `Buy Access Token for resource ${resourceId}`;
            logger.info(`[ContractService] buyAccessToken: Expected message for signature: '${expectedMessage}'`);
            logger.info(`[ContractService] buyAccessToken: Received message for signature: '${message}'`);
            logger.info(`[ContractService] buyAccessToken: Received signature: '${signature}'`);

            // 从 AccessToken 合约获取价格配置
            const accessConfig = await this.accessTokenContract.getResourceAccessConfig(resourceId);
            const price = accessConfig[2]; // price is the third return value
            const isActive = accessConfig[3]; // isActive is the fourth return value
            logger.info(`[ContractService] buyAccessToken: Fetched access token price: ${price.toString()} for resourceId: ${resourceId}, isActive: ${isActive}`);

            if (!price || price.toString() === "0" || !isActive) {
                logger.warn(`[ContractService] buyAccessToken: Access token not properly configured for resourceId: ${resourceId} (price=${price}, isActive=${isActive})`);
                throw new Error('ACCESS_CONFIG_REQUIRED:该资源的访问权配置尚未设置或未激活，请联系资源所有者设置访问权配置');
            }

            // 检查用户余额
            const userBalance = await this.provider.getBalance(userAddress);
            logger.info(`[ContractService] buyAccessToken: User balance: ${userBalance.toString()}, Required price: ${price.toString()}`);
            if (userBalance < price) {
                logger.warn(`[ContractService] buyAccessToken: Insufficient funds - User balance (${userBalance.toString()}) is less than required price (${price.toString()})`);
                throw new Error('INSUFFICIENT_FUNDS:用户余额不足，无法支付访问权费用');
            }

            // 检查资源是否存在
            const exists = await this.isResourceExists(resourceId);
            if (!exists) {
                logger.error(`[ContractService] buyAccessToken: Resource ${resourceId} does not exist`);
                throw new Error('RESOURCE_NOT_FOUND:资源不存在');
            }

            // 检查是否还有可用的访问权名额
            const currentTokens = BigInt(accessConfig[1]); // currentAccessTokens is the second return value
            const maxTokens = BigInt(accessConfig[0]); // maxAccessTokens is the first return value
            if (currentTokens >= maxTokens) {
                logger.error(`[ContractService] buyAccessToken: No more access tokens available for resource ${resourceId} (${currentTokens}/${maxTokens})`);
                throw new Error('NO_TOKENS_AVAILABLE:该资源的访问权已售罄');
            }

            // 检查用户是否已经拥有该资源的访问权
            const accessStatus = await this.checkAccess(resourceId, userAddress);
            if (accessStatus.hasAccess) {
                logger.error(`[ContractService] buyAccessToken: User ${userAddress} already has access to resource ${resourceId}`);
                throw new Error('ALREADY_HAS_ACCESS:您已经拥有该资源的访问权');
            }

            // 检查参数有效性
            if (duration <= 0) {
                throw new Error('INVALID_DURATION:访问时长必须大于0');
            }
            if (maxUses <= 0) {
                throw new Error('INVALID_MAX_USES:最大使用次数必须大于0');
            }

            try {
                // 直接使用固定的gas限制
                const gasLimit = 500000; // 使用较大的固定值
                logger.info(`[ContractService] buyAccessToken: Using fixed gas limit: ${gasLimit}`);

                // 构造交易选项
                const txOptions = {
                    value: price,
                    gasLimit: gasLimit
                };

                logger.info(`[ContractService] buyAccessToken: Sending transaction with options:`, {
                    resourceId,
                    duration,
                    maxUses,
                    value: price.toString(),
                    gasLimit: gasLimit.toString()
                });

                const tx = await this.marketContract.buyAccessToken(
                    resourceId,
                    duration,
                    maxUses,
                    txOptions
                );

                logger.info(`[ContractService] buyAccessToken: Transaction sent, tx hash: ${tx.hash}`);
                
                // 等待交易确认
                logger.info(`[ContractService] buyAccessToken: Waiting for transaction confirmation...`);
                const receipt = await tx.wait();
                logger.info(`[ContractService] buyAccessToken: Transaction confirmed, receipt:`, {
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString(),
                    status: receipt.status
                });

                // 从事件中提取 accessTokenId
                let accessTokenId = null;
                if (receipt.events) {
                    const accessTokenSoldEvent = receipt.events.find(e => e.event === 'AccessTokenSold');
                    if (accessTokenSoldEvent && accessTokenSoldEvent.args) {
                        accessTokenId = accessTokenSoldEvent.args.accessTokenId.toString();
                        logger.info(`[ContractService] buyAccessToken: AccessTokenId from event: ${accessTokenId}`);
                    }
                }

                return {
                    success: true,
                    accessTokenId,
                    transactionHash: tx.hash
                };
            } catch (txError) {
                // 捕获并记录合约调用错误
                const errorMessage = txError.message || '未知错误';
                const errorReason = txError.reason || (txError.error?.reason) || '未提供原因';
                const errorCode = txError.code || (txError.error?.code) || 'UNKNOWN';
                
                logger.error(`[ContractService] buyAccessToken: Transaction error: ${errorMessage}, Reason: ${errorReason}, Code: ${errorCode}`);
                
                if (errorMessage.includes('insufficient funds') || errorCode === 'INSUFFICIENT_FUNDS') {
                    throw new Error('INSUFFICIENT_FUNDS:用户余额不足，无法支付访问权费用');
                }
                
                if (errorMessage.includes('gas required exceeds allowance')) {
                    throw new Error('GAS_LIMIT:交易所需Gas超过允许范围，请增加Gas限制或减少操作复杂度');
                }
                
                throw new Error(`CONTRACT_ERROR:合约执行失败: ${errorReason || errorMessage}`);
            }
        } catch (error) {
            logger.error(`[ContractService] buyAccessToken: Error purchasing access token for resourceId ${resourceId}, user ${userAddress}: `, error);
            // 保留原始错误类型，便于前端处理
            if (error.message.startsWith('ACCESS_CONFIG_REQUIRED:') || 
                error.message.startsWith('INSUFFICIENT_FUNDS:') ||
                error.message.startsWith('GAS_LIMIT:') ||
                error.message.startsWith('CONTRACT_ERROR:')) {
                throw error; // 直接抛出带前缀的错误
            }
            // 其他未分类的错误
            throw new Error(`UNKNOWN_ERROR:购买访问权失败: ${error.message}`);
        }
    }

    async useAccessToken(accessTokenId, userAddress) {
        try {
            logger.info(`[ContractService] useAccessToken: 用户 ${userAddress} 使用访问权 ${accessTokenId}`);
            
            // 使用 accessTokenContract 而不是 marketContract
            const tx = await this.accessTokenContract.useAccessToken(accessTokenId, {
                from: userAddress
            });
            
            logger.info(`[ContractService] useAccessToken: 交易已发送 ${tx.hash}`);
            
            // 等待交易确认
            const receipt = await tx.wait();
            logger.info(`[ContractService] useAccessToken: 交易已确认 ${receipt.transactionHash}`);
            
            return tx;
        } catch (error) {
            logger.error('[ContractService] useAccessToken: 使用访问权失败:', error);
            throw error;
        }
    }

    async burnAccessToken(accessTokenId, userAddress) {
        try {
            const tx = await this.marketContract.burnAccessToken(accessTokenId, {
                from: userAddress
            });
            return tx;
        } catch (error) {
            logger.error('销毁访问权失败:', error);
            throw error;
        }
    }

    async getAccessToken(accessTokenId) {
        try {
            const accessToken = await this.marketContract.accessTokens(accessTokenId);
            return {
                id: accessTokenId,
                owner: accessToken.owner,
                resourceId: accessToken.resourceId,
                expiresAt: accessToken.expiresAt,
                usesLeft: accessToken.usesLeft
            };
        } catch (error) {
            logger.error('获取访问权信息失败:', error);
            throw error;
        }
    }

    async checkAccess(resourceId, userAddress) {
        logger.info(`[ContractService] checkAccess: Checking access for resourceId: ${resourceId}, userAddress: ${userAddress}`);
        try {
            const userAccessTokens = await this.accessTokenContract.getUserAccessTokens(userAddress);
            logger.info(`[ContractService] checkAccess: User ${userAddress} has ${userAccessTokens.length} access tokens. Tokens: [${userAccessTokens.join(', ')}]`);
            
            if (userAccessTokens.length === 0) {
                logger.info(`[ContractService] checkAccess: User ${userAddress} has no access tokens. Access denied for resourceId ${resourceId}.`);
                return {
                    hasAccess: false,
                    accessToken: null
                };
            }

            for (const tokenId of userAccessTokens) {
                logger.info(`[ContractService] checkAccess: Checking token ID: ${tokenId} for user ${userAddress}...`);
                const metadata = await this.accessTokenContract.getAccessMetadata(tokenId);
                logger.info(`[ContractService] checkAccess: Metadata for token ID ${tokenId}: resourceId=${metadata.resourceId}, isActive=${metadata.isActive}, expiryTime=${metadata.expiryTime}, usedCount=${metadata.usedCount}, maxUses=${metadata.maxUses}`);
                
                if (metadata.resourceId.toString() === resourceId.toString() &&
                    metadata.isActive &&
                    BigInt(metadata.expiryTime) > BigInt(Math.floor(Date.now() / 1000)) &&
                    BigInt(metadata.usedCount) < BigInt(metadata.maxUses)) {
                    
                    logger.info(`[ContractService] checkAccess: Valid access token found for resourceId ${resourceId}`);
                    return {
                        hasAccess: true,
                        accessToken: {
                            tokenId: tokenId.toString(),
                            resourceId: metadata.resourceId.toString(),
                            accessType: 'temporary',
                            expiryTime: new Date(Number(metadata.expiryTime) * 1000),
                            maxUses: Number(metadata.maxUses),
                            usedCount: Number(metadata.usedCount),
                            isActive: metadata.isActive
                        }
                    };
                }
            }

            logger.info(`[ContractService] checkAccess: No valid access token found for resourceId ${resourceId}`);
            return {
                hasAccess: false,
                accessToken: null
            };
        } catch (error) {
            logger.error(`[ContractService] checkAccess: Error checking access for resourceId ${resourceId}, userAddress ${userAddress}:`, error);
            throw error;
        }
    }

    async getRoyaltyPercentage(resourceId) {
        logger.info(`[ContractService] getRoyaltyPercentage: Getting royalty percentage for resourceId: ${resourceId}`);
        try {
            // 尝试调用 marketContract 上的 getRoyaltyPercentage
            // 注意：此方法在 Market.sol 中是 public view
            const royalty = await this.marketContract.getRoyaltyPercentage(resourceId);
            logger.info(`[ContractService] getRoyaltyPercentage: Royalty percentage for resourceId ${resourceId} is ${royalty.toString()}`);
            return royalty;
        } catch (error) {
            logger.error(`[ContractService] getRoyaltyPercentage: Error getting royalty percentage for resourceId ${resourceId}: `, error);
            // 如果合约调用失败，可以返回一个默认值或继续抛出错误
            // 这里我们选择继续抛出错误，因为这是一个预期应该存在的方法
            throw error;
        }
    }

    async getCreator(resourceId) {
        logger.info(`[ContractService] getCreator: Fetching metadata for resourceId: ${resourceId}`);
        // metadata: title, description, ipfsHash, resourceType, authors, timestamp
        const metadata = await this.academicNFTContract.getResourceMetadata(resourceId);
        
        // 转换为可安全记录的格式，避免BigInt序列化问题
        const loggableMetadata = {
            title: metadata.title,
            description: metadata.description,
            ipfsHash: metadata.ipfsHash,
            resourceType: metadata.resourceType.toString(), 
            authors: metadata.authors,
            timestamp: metadata.timestamp.toString() 
        };
        logger.info(`[ContractService] getCreator: Metadata fetched for resourceId ${resourceId}: ${JSON.stringify(loggableMetadata)}`);

        if (metadata && metadata.authors && metadata.authors.length > 0) {
            logger.info(`[ContractService] getCreator: Found authors for resourceId ${resourceId}. First author (creator): ${metadata.authors[0]}`);
            return metadata.authors[0]; // 假设第一个作者是创建者
        }
        logger.warn(`[ContractService] getCreator: No authors found for resourceId ${resourceId}. Returning address(0).`);
        return ethers.constants.AddressZero;
    }

    // 获取资源访问权配置
    async getAccessTokenConfig(resourceId) {
        logger.info(`[ContractService] getAccessTokenConfig: 获取资源 ${resourceId} 的访问权配置`);
        try {
            // 调用 AccessToken 合约的 getResourceAccessConfig 方法
            const config = await this.accessTokenContract.getResourceAccessConfig(resourceId);
            logger.info(`[ContractService] getAccessTokenConfig: 获取到配置:`, {
                maxAccessTokens: config[0].toString(),
                currentAccessTokens: config[1].toString(),
                price: config[2].toString(),
                isActive: config[3]
            });
            
            return {
                maxAccessTokens: config[0].toString(),
                currentAccessTokens: config[1].toString(),
                price: config[2].toString(),
                isActive: config[3]
            };
        } catch (error) {
            logger.error(`[ContractService] getAccessTokenConfig: 获取访问权配置失败:`, error);
            // 如果配置不存在，返回默认值
            return {
                maxAccessTokens: "100", 
                currentAccessTokens: "0",
                price: "10000000000000000", // 0.01 ETH
                isActive: true,
                error: error.message
            };
        }
    }

    // 设置资源访问权配置
    async setAccessTokenConfig(resourceId, maxTokens, price, isActive, userAddress) {
        logger.info(`[ContractService] setAccessTokenConfig: 设置资源 ${resourceId} 的访问权配置: maxTokens=${maxTokens}, price=${price}, isActive=${isActive}, userAddress=${userAddress}`);
        try {
            // 先检查用户是否是资源所有者或合约所有者
            const isOwner = await this.isResourceOwner(resourceId, userAddress);
            const isContractOwner = (await this.accessTokenContract.owner()).toLowerCase() === userAddress.toLowerCase();
            
            if (!isOwner && !isContractOwner) {
                logger.error(`[ContractService] setAccessTokenConfig: 用户 ${userAddress} 不是资源 ${resourceId} 的所有者，也不是合约所有者`);
                throw new Error('您不是该资源的所有者或访问权合约的所有者，无法设置访问权配置');
            }
            
            // 调用 AccessToken 合约的 setResourceAccessConfig 方法
            const tx = await this.accessTokenContract.setResourceAccessConfig(
                resourceId,
                maxTokens,
                price,
                isActive
            );
            
            logger.info(`[ContractService] setAccessTokenConfig: 交易已发送, txHash: ${tx.hash}`);
            
            const receipt = await tx.wait();
            logger.info(`[ContractService] setAccessTokenConfig: 交易已确认, blockNumber: ${receipt.blockNumber}, gasUsed: ${receipt.gasUsed.toString()}`);
            
            return {
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                maxTokens: maxTokens.toString(),
                price: price.toString(),
                isActive: isActive
            };
        } catch (error) {
            logger.error(`[ContractService] setAccessTokenConfig: 设置访问权配置失败:`, error);
            throw error;
        }
    }

    // 检查用户是否是资源所有者
    async isResourceOwner(resourceId, userAddress) {
        logger.info(`[ContractService] isResourceOwner: 检查用户 ${userAddress} 是否是资源 ${resourceId} 的所有者`);
        try {
            const owner = await this.academicNFTContract.ownerOf(resourceId);
            logger.info(`[ContractService] isResourceOwner: 资源 ${resourceId} 的所有者是 ${owner}`);
            return owner.toLowerCase() === userAddress.toLowerCase();
        } catch (error) {
            logger.error(`[ContractService] isResourceOwner: 检查所有权失败:`, error);
            return false;
        }
    }

    // 检查资源是否存在
    async isResourceExists(resourceId) {
        logger.info(`[ContractService] isResourceExists: 检查资源 ${resourceId} 是否存在`);
        try {
            // 调用 AcademicNFT 合约的 ownerOf 方法检查资源是否存在
            const owner = await this.academicNFTContract.ownerOf(resourceId);
            logger.info(`[ContractService] isResourceExists: 资源 ${resourceId} 存在，所有者: ${owner}`);
            return true;
        } catch (error) {
            logger.warn(`[ContractService] isResourceExists: 资源 ${resourceId} 不存在或查询失败: ${error.message}`);
            return false;
        }
    }

    // 获取资源的访问权配置
    async getResourceAccessConfig(resourceId) {
        logger.info(`[ContractService] getResourceAccessConfig: 获取资源 ${resourceId} 的访问权配置`);
        try {
            // 调用 AccessToken 合约的 getResourceAccessConfig 方法
            const config = await this.accessTokenContract.getResourceAccessConfig(resourceId);
            
            // 格式化返回结果
            const formattedConfig = {
                maxAccessTokens: config[0].toString(),
                currentAccessTokens: config[1].toString(),
                price: config[2].toString(),
                isActive: config[3]
            };
            
            logger.info(`[ContractService] getResourceAccessConfig: 资源 ${resourceId} 的访问权配置: ${JSON.stringify(formattedConfig)}`);
            return formattedConfig;
        } catch (error) {
            logger.error(`[ContractService] getResourceAccessConfig: 获取资源 ${resourceId} 的访问权配置失败: ${error.message}`);
            throw new Error(`获取访问权配置失败: ${error.message}`);
        }
    }

    // 获取资源内容 
    async getResourceContent(resourceId) {
        logger.info(`[ContractService] getResourceContent: 获取资源 ${resourceId} 的内容`);
        try {
            // 获取资源元数据
            const metadata = await this.academicNFTContract.getResourceMetadata(resourceId);
            const ipfsHash = metadata.ipfsHash;
            
            if (!ipfsHash || ipfsHash === '') {
                logger.warn(`[ContractService] getResourceContent: 资源 ${resourceId} 没有 IPFS 哈希`);
                throw new Error('资源没有 IPFS 哈希');
            }
            
            logger.info(`[ContractService] getResourceContent: 资源 ${resourceId} 的 IPFS 哈希: ${ipfsHash}`);
            
            // 导入 IPFS 服务
            const ipfsService = (await import('../services/ipfs.js')).default;
            
            // 从 IPFS 获取内容
            const fileBuffer = await ipfsService.getFile(ipfsHash);
            
            // 尝试将内容转换为文本
            let content;
            try {
                content = fileBuffer.toString('utf8');
                logger.info(`[ContractService] getResourceContent: 成功获取资源 ${resourceId} 的内容，长度 ${content.length}`);
            } catch (error) {
                logger.warn(`[ContractService] getResourceContent: 无法将资源内容转换为文本，将返回 base64 编码`);
                content = `该资源内容无法直接显示，可能是二进制文件。请下载完整资源进行查看。\n\n资源信息:\n文件类型: 二进制\nIPFS 哈希: ${ipfsHash}\n资源ID: ${resourceId}`;
            }
            
            return content;
        } catch (error) {
            logger.error(`[ContractService] getResourceContent: 获取资源 ${resourceId} 内容失败:`, error);
            throw new Error(`获取资源内容失败: ${error.message}`);
        }
    }
} 