import { ethers } from 'ethers';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import contracts from '../config/contracts.js';
import NFT from '../models/nft.model.js';
import cacheService from './cache.js';
import IndexerState from '../models/indexer-state.model.js';

class BlockchainIndexer {
    constructor() {
        this.provider = null;
        this.academicNFTContract = null;
        this.marketContract = null;
        this.lastProcessedBlock = 0;
        this.isIndexing = false;
        this.isListening = false;
        this.requestCount = 0;
        this.lastRequestTime = Date.now();
        this.rateLimit = {
            maxRequests: 1000,        // 提高请求限制
            timeWindow: 1000,         // 保持1秒时间窗口
            minDelay: 50,             // 降低最小延迟
            requestCount: 0,
            lastReset: Date.now(),
            batchSize: 1000,          // 增加批量查询大小
            retryDelay: 1000          // 降低重试延迟
        };
        this.retryCount = 0;
        this.maxRetries = 5;
        this.baseDelay = 5000;
        this.maxDelay = 30000;
        this.initialize();
    }

    async initialize() {
        try {
            logger.info('初始化区块链索引器...');
            this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl, undefined, {
                timeout: 30000,
                retry: false // 禁用内置重试
            });

            // 测试连接
            await this.provider.getNetwork();
            logger.info('RPC连接测试成功');

            this.academicNFTContract = new ethers.Contract(
                contracts.academicNFT.address,
                contracts.academicNFT.abi,
                this.provider
            );
            this.marketContract = new ethers.Contract(
                contracts.market.address,
                contracts.market.abi,
                this.provider
            );

            // 读取上次处理的区块高度
            this.lastProcessedBlock = await this._getLastProcessedBlock();
            logger.info(`上次处理区块高度: ${this.lastProcessedBlock}`);

            // 检查合约支持哪些事件
            this.supportedEvents = await this._detectSupportedEvents();
            logger.info(`支持的事件: ${Object.keys(this.supportedEvents).join(', ')}`);

            logger.info('索引器服务初始化成功');
            this.retryCount = 0;
            return true;
        } catch (error) {
            logger.error('索引器服务初始化失败:', error);
            
            if (this.retryCount < this.maxRetries) {
                const delay = Math.min(
                    this.baseDelay * Math.pow(2, this.retryCount),
                    this.maxDelay
                );
                this.retryCount++;
                logger.info(`将在 ${delay/1000} 秒后重试 (第 ${this.retryCount} 次)`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.initialize();
            } else {
                logger.error('达到最大重试次数，请检查网络连接和RPC配置');
                throw new Error('索引器服务初始化失败，请检查网络连接和RPC配置');
            }
        }
    }

    // 添加重连方法
    async reconnect() {
        logger.info('尝试重新连接索引器服务...');
        this.retryCount = 0;
        return this.initialize();
    }

    // 添加健康检查方法
    async checkHealth() {
        try {
            if (!this.provider) {
                return false;
            }
            await this.provider.getNetwork();
            return true;
        } catch (error) {
            logger.error('索引器服务健康检查失败:', error);
            return false;
        }
    }

    // 检测合约支持的事件
    async _detectSupportedEvents() {
        const supportedEvents = {
            ResourceMinted: false,
            Transfer: false,
            TokenListed: false,
            TokenUnlisted: false,
            TokenSold: false,
            ReferenceCreated: false
        };

        try {
            // 检查 AcademicNFT 合约的事件
            if (this.academicNFTContract && this.academicNFTContract.interface) {
                const events = this.academicNFTContract.interface.fragments.filter(f => f.type === 'event');
                logger.info(`AcademicNFT合约定义了 ${events.length} 个事件`);
                
                // 获取事件名称列表
                const eventNames = events.map(e => e.name);
                logger.info(`AcademicNFT事件列表: ${eventNames.join(', ')}`);
                
                // 检查每个我们需要的事件是否支持
                if (eventNames.includes('ResourceMinted')) {
                    try {
                        const filter = this.academicNFTContract.filters.ResourceMinted();
                        supportedEvents.ResourceMinted = !!filter;
                        logger.info('ResourceMinted事件过滤器创建成功');
                    } catch (e) {
                        logger.warn(`ResourceMinted事件过滤器创建失败: ${e.message}`);
                        supportedEvents.ResourceMinted = false;
                    }
                }
                
                if (eventNames.includes('Transfer')) {
                    try {
                        const filter = this.academicNFTContract.filters.Transfer();
                        supportedEvents.Transfer = !!filter;
                        logger.info('Transfer事件过滤器创建成功');
                    } catch (e) {
                        logger.warn(`Transfer事件过滤器创建失败: ${e.message}`);
                        supportedEvents.Transfer = false;
                    }
                }
            }

            // 检查 Market 合约的事件
            if (this.marketContract && this.marketContract.interface) {
                const marketEvents = this.marketContract.interface.fragments.filter(f => f.type === 'event');
                const marketEventNames = marketEvents.map(e => e.name);
                logger.info(`Market合约定义了 ${marketEvents.length} 个事件: ${marketEventNames.join(', ')}`);

                // 检查 TokenListed 事件
                if (marketEventNames.includes('TokenListed')) {
                    try {
                        const filter = this.marketContract.filters.TokenListed();
                        supportedEvents.TokenListed = !!filter;
                        logger.info('TokenListed事件过滤器创建成功');
                    } catch (e) {
                        logger.warn(`TokenListed事件过滤器创建失败: ${e.message}`);
                        supportedEvents.TokenListed = false;
                    }
                }

                // 检查 TokenSold 事件
                if (marketEventNames.includes('TokenSold')) {
                    try {
                        const filter = this.marketContract.filters.TokenSold();
                        supportedEvents.TokenSold = !!filter;
                        logger.info('TokenSold事件过滤器创建成功');
                    } catch (e) {
                        logger.warn(`TokenSold事件过滤器创建失败: ${e.message}`);
                        supportedEvents.TokenSold = false;
                    }
                }
            }

            return supportedEvents;
        } catch (error) {
            logger.error('检测支持的事件时出错:', error);
            return {
                ResourceMinted: false,
                Transfer: false,
                TokenListed: false,
                TokenUnlisted: false,
                TokenSold: false,
                ReferenceCreated: false
            };
        }
    }

    // 更新限速方法
    async _rateLimit() {
        const now = Date.now();
        if (now - this.rateLimit.lastReset >= this.rateLimit.timeWindow) {
            this.rateLimit.requestCount = 0;
            this.rateLimit.lastReset = now;
        }

        if (this.rateLimit.requestCount >= this.rateLimit.maxRequests) {
            const waitTime = this.rateLimit.timeWindow - (now - this.rateLimit.lastReset);
            if (waitTime > 0) {
                logger.info(`达到速率限制，等待 ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                this.rateLimit.requestCount = 0;
                this.rateLimit.lastReset = Date.now();
            }
        }

        this.rateLimit.requestCount++;
        await new Promise(resolve => setTimeout(resolve, this.rateLimit.minDelay));
    }

    // 启动索引器
    async start(skipHistoricalSync = false) {
        if (!this.provider || !this.academicNFTContract) {
            const initialized = await this.initialize();
            if (!initialized) return false;
        }

        try {
            if (skipHistoricalSync) {
                // 跳过历史同步，仅更新最后处理的区块高度为当前高度
                try {
                    const currentBlock = await this.provider.getBlockNumber();
                    this.lastProcessedBlock = currentBlock;
                    await this._saveLastProcessedBlock(currentBlock);
                    logger.info(`已跳过历史同步，将最后处理区块设置为当前区块: ${currentBlock}`);
                } catch (error) {
                    logger.error('设置当前区块高度失败:', error);
                    return false;
                }
            } else {
                // 开始同步历史事件
                await this.syncHistoricalEvents();
            }
            
            // 开始监听实时事件
            await this.startListening();
            
            return true;
        } catch (error) {
            logger.error('启动区块链索引器失败:', error);
            return false;
        }
    }

    // 停止索引器
    async stop() {
        try {
            logger.info('停止区块链索引器...');
            
            // 停止实时监听
            if (this.isListening) {
                this.academicNFTContract.removeAllListeners();
                this.isListening = false;
                logger.info('已停止事件监听');
            }
            
            // 标记同步停止
            this.isIndexing = false;
            
            return true;
        } catch (error) {
            logger.error('停止区块链索引器失败:', error);
            return false;
        }
    }

    // 同步历史事件
    async syncHistoricalEvents() {
        if (this.isIndexing) {
            logger.warn('索引器已在运行，跳过本次同步');
            return false;
        }

        try {
            this.isIndexing = true;
            logger.info('开始同步历史事件...');
            
            const currentBlock = await this.provider.getBlockNumber();
            const BLOCK_CHUNK_SIZE = 500; // 进一步减小块大小
            const DELAY_BETWEEN_CHUNKS = 800; // 进一步增加块之间的延迟
            const DELAY_BETWEEN_EVENTS = 300; // 切换事件类型时的延迟

            // 事件优先模式：先同步所有区块的某一事件类型，再切换下一个
            const eventSyncTasks = [
                {
                    name: 'ResourceMinted',
                    enabled: this.supportedEvents.ResourceMinted,
                    handler: async (fromBlock, toBlock) => await this._processResourceMintedEvents(fromBlock, toBlock)
                },
                {
                    name: 'Transfer',
                    enabled: this.supportedEvents.Transfer,
                    handler: async (fromBlock, toBlock) => await this._processTransferEvents(fromBlock, toBlock)
                },
                {
                    name: 'TokenListed',
                    enabled: this.supportedEvents.TokenListed,
                    handler: async (fromBlock, toBlock) => await this._processTokenListedEvents(fromBlock, toBlock)
                },
                {
                    name: 'TokenSold',
                    enabled: this.supportedEvents.TokenSold,
                    handler: async (fromBlock, toBlock) => await this._processTokenSoldEvents(fromBlock, toBlock)
                },
                {
                    name: 'TokenUnlisted',
                    enabled: this.supportedEvents.TokenUnlisted,
                    handler: async (fromBlock, toBlock) => await this._processTokenUnlistedEvents(fromBlock, toBlock)
                },
                {
                    name: 'ReferenceCreated',
                    enabled: this.supportedEvents.ReferenceCreated,
                    handler: async (fromBlock, toBlock) => await this._processReferenceCreatedEvents(fromBlock, toBlock)
                }
            ];

            for (const task of eventSyncTasks) {
                if (!task.enabled) continue;
                logger.info(`开始同步事件类型: ${task.name}`);
                for (let fromBlock = this.lastProcessedBlock + 1; fromBlock <= currentBlock; fromBlock += BLOCK_CHUNK_SIZE) {
                    const toBlock = Math.min(fromBlock + BLOCK_CHUNK_SIZE - 1, currentBlock);
                    try {
                        await task.handler(fromBlock, toBlock);
                        // 更新处理进度
                        this.lastProcessedBlock = toBlock;
                        await this._saveLastProcessedBlock(toBlock);
                    } catch (error) {
                        logger.error(`处理事件 ${task.name} 区块范围 ${fromBlock} - ${toBlock} 失败:`, error);
                        if (error.message && error.message.includes('Too Many Requests')) {
                            logger.warn('遇到请求限制，等待10秒后继续...');
                            await new Promise(resolve => setTimeout(resolve, 10000));
                            continue;
                        }
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
                }
                logger.info(`完成事件类型: ${task.name} 的同步，等待 ${DELAY_BETWEEN_EVENTS/1000} 秒后切换下一个事件`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EVENTS));
            }

            logger.info(`历史事件同步完成，当前区块高度: ${this.lastProcessedBlock}`);
            this.isIndexing = false;
            return true;
        } catch (error) {
            logger.error('同步历史事件失败:', error);
            this.isIndexing = false;
            return false;
        }
    }

    // 开始监听实时事件
    async startListening() {
        if (this.isListening) {
            logger.warn('事件监听已在运行');
            return true;
        }

        try {
            // 确保合约已初始化
            if (!this.academicNFTContract || !this.marketContract) {
                logger.error('合约未初始化，无法监听事件');
                return false;
            }

            // 监听铸造事件
            if (this.supportedEvents.ResourceMinted) {
                try {
                    this.academicNFTContract.on('ResourceMinted', async (creator, tokenId, title, description, ipfsHash, resourceType, authors, event) => {
                        logger.info(`检测到ResourceMinted事件: tokenId=${tokenId}, creator=${creator}`);
                        try {
                            const block = await event.getBlock();
                            await this._handleResourceMinted(
                                creator,
                                tokenId,
                                title,
                                description,
                                ipfsHash,
                                resourceType,
                                authors,
                                {
                                    ...event,
                                    blockNumber: block.number,
                                    timestamp: block.timestamp,
                                    transactionHash: event.transactionHash
                                }
                            );
                        } catch (error) {
                            logger.error('处理ResourceMinted事件失败:', error);
                        }
                    });
                    logger.info('ResourceMinted事件监听已启动');
                } catch (error) {
                    logger.error(`启动ResourceMinted事件监听失败: ${error.message}`);
                    this.supportedEvents.ResourceMinted = false;
                }
            }

            // 监听转移事件
            if (this.supportedEvents.Transfer) {
                try {
                    this.academicNFTContract.on('Transfer', async (from, to, tokenId, event) => {
                        logger.info(`检测到Transfer事件: tokenId=${tokenId}, from=${from}, to=${to}`);
                        try {
                            const block = await event.getBlock();
                            await this._handleTransfer(
                                from,
                                to,
                                tokenId,
                                {
                                    ...event,
                                    blockNumber: block.number,
                                    timestamp: block.timestamp,
                                    transactionHash: event.transactionHash
                                }
                            );
                        } catch (error) {
                            logger.error('处理Transfer事件失败:', error);
                        }
                    });
                    logger.info('Transfer事件监听已启动');
                } catch (error) {
                    logger.error(`启动Transfer事件监听失败: ${error.message}`);
                    this.supportedEvents.Transfer = false;
                }
            }

            // 监听上架事件
            if (this.supportedEvents.TokenListed) {
                try {
                    this.marketContract.on('TokenListed', async (tokenId, seller, price, event) => {
                        logger.info(`检测到TokenListed事件: tokenId=${tokenId}, seller=${seller}, price=${price}`);
                        await this._handleTokenListed(tokenId, seller, price, event);
                    });
                    logger.info('TokenListed事件监听已启动');
                } catch (error) {
                    logger.error(`启动TokenListed事件监听失败: ${error.message}`);
                    this.supportedEvents.TokenListed = false;
                }
            }

            // 监听售出事件
            if (this.supportedEvents.TokenSold) {
                try {
                    this.marketContract.on('TokenSold', async (tokenId, seller, buyer, price, event) => {
                        try {
                            const tokenIdStr = tokenId.toString();
                            const buyerStr = buyer.toLowerCase();
                            const sellerStr = seller.toLowerCase();
                            
                            // 先清除所有相关缓存
                            try {
                                // 清除 NFT 详情缓存
                                await cacheService.invalidateNFT(tokenIdStr);
                                // 清除买卖双方的 NFT 列表缓存
                                await cacheService.invalidateUserNFTs(buyerStr);
                                await cacheService.invalidateUserNFTs(sellerStr);
                                // 清除市场列表缓存
                                await cacheService.invalidateMarketList();
                                logger.info(`已预先清除所有相关缓存`);
                            } catch (cacheError) {
                                logger.error(`预先清除缓存失败: ${cacheError.message}`);
                            }
                            
                            // 更新数据库
                            const updateResult = await NFT.findOneAndUpdate(
                                { tokenId: tokenIdStr },
                                {
                                    $set: {
                                        currentOwner: buyerStr,
                                        'listing.active': false,
                                        'listing.price': '0',
                                        'listing.seller': '',
                                        'listing.timestamp': 0,
                                        lastTransferredAt: new Date()
                                    },
                                    $push: {
                                        transfers: {
                                            from: sellerStr,
                                            to: buyerStr,
                                            timestamp: new Date(),
                                            blockNumber: event.blockNumber,
                                            transactionHash: event.transactionHash
                                        }
                                    }
                                },
                                { new: true }
                            );
                            
                            if (updateResult) {
                                logger.info(`记录售出事件: ${tokenId} 从 ${seller} 到 ${buyer} 价格 ${price}`);
                                
                                // 再次清除所有相关缓存，确保数据完全更新
                                try {
                                    await cacheService.invalidateNFT(tokenIdStr);
                                    await cacheService.invalidateUserNFTs(buyerStr);
                                    await cacheService.invalidateUserNFTs(sellerStr);
                                    await cacheService.invalidateMarketList();
                                    logger.info(`已再次清除所有相关缓存`);
                                } catch (cacheError) {
                                    logger.error(`再次清除缓存失败: ${cacheError.message}`);
                                }
                            } else {
                                logger.warn(`未找到要更新的NFT记录: tokenId=${tokenIdStr}`);
                            }
                        }
                        catch (error) {
                            logger.error('处理售出事件失败:', error);
                        }
                    });
                    logger.info('TokenSold事件监听已启动');
                } catch (error) {
                    logger.error(`启动TokenSold事件监听失败: ${error.message}`);
                    this.supportedEvents.TokenSold = false;
                }
            }

            this.isListening = true;
            logger.info('事件监听已启动');
            return true;
        } catch (error) {
            logger.error('启动事件监听失败:', error);
            return false;
        }
    }

    // 处理ResourceMinted事件的历史记录
    async _processResourceMintedEvents(fromBlock, toBlock) {
        try {
            // 确保合约支持该事件
            if (!this.supportedEvents.ResourceMinted) {
                logger.info('合约不支持ResourceMinted事件，跳过处理');
                return;
            }

            logger.info(`查询ResourceMinted事件, 区块范围: ${fromBlock}-${toBlock}`);
            
            // 尝试创建过滤器并查询
            let filter;
            try {
                filter = this.academicNFTContract.filters.ResourceMinted();
            } catch (error) {
                logger.error(`无法创建ResourceMinted事件过滤器: ${error.message}`);
                this.supportedEvents.ResourceMinted = false; // 禁用该事件的查询
                return;
            }
            
            // 使用创建的过滤器查询
            const events = await this.academicNFTContract.queryFilter(
                filter,
                fromBlock,
                toBlock
            );

            logger.info(`找到 ${events.length} 个ResourceMinted事件`);

            for (const event of events) {
                try {
                    const args = event.args;
                    if (args && args.length >= 7) {
                        const creator = args[0];
                        const tokenId = args[1];
                        const title = args[2];
                        const description = args[3];
                        const ipfsHash = args[4];
                        const resourceType = args[5];
                        const authors = args[6];

                        await this._handleResourceMinted(
                            creator,
                            tokenId,
                            title,
                            description,
                            ipfsHash,
                            resourceType,
                            authors,
                            event
                        );
                    }
                } catch (err) {
                    logger.error(`处理ResourceMinted事件失败: ${err.message}`);
                }
            }
        } catch (error) {
            logger.error(`查询ResourceMinted事件失败: ${error.message}`);
            // 如果查询失败，也禁用该事件的查询
            this.supportedEvents.ResourceMinted = false;
        }
    }

    // 处理Transfer事件的历史记录
    async _processTransferEvents(fromBlock, toBlock) {
        try {
            // 确保合约支持该事件
            if (!this.supportedEvents.Transfer) {
                logger.info('合约不支持Transfer事件，跳过处理');
                return;
            }

            logger.info(`查询Transfer事件, 区块范围: ${fromBlock}-${toBlock}`);
            
            // 尝试创建过滤器并查询
            let filter;
            try {
                filter = this.academicNFTContract.filters.Transfer();
            } catch (error) {
                logger.error(`无法创建Transfer事件过滤器: ${error.message}`);
                this.supportedEvents.Transfer = false; // 禁用该事件的查询
                return;
            }
            
            // 使用创建的过滤器查询
            const events = await this.academicNFTContract.queryFilter(
                filter,
                fromBlock,
                toBlock
            );

            logger.info(`找到 ${events.length} 个Transfer事件`);

            for (const event of events) {
                try {
                    const args = event.args;
                    if (args && args.length >= 3) {
                        const from = args[0];
                        const to = args[1];
                        const tokenId = args[2];

                        await this._handleTransfer(from, to, tokenId, event);
                    }
                } catch (err) {
                    logger.error(`处理Transfer事件失败: ${err.message}`);
                }
            }
        } catch (error) {
            logger.error(`查询Transfer事件失败: ${error.message}`);
            // 如果查询失败，也禁用该事件的查询
            this.supportedEvents.Transfer = false;
        }
    }

    // 更新事件查询方法
    async _queryEvents(contract, eventName, fromBlock, toBlock) {
        try {
            await this._rateLimit();
            
            // 如果区块范围太大，分批处理
            if (toBlock - fromBlock > this.rateLimit.batchSize) {
                const batches = [];
                for (let i = fromBlock; i <= toBlock; i += this.rateLimit.batchSize) {
                    const batchEnd = Math.min(i + this.rateLimit.batchSize - 1, toBlock);
                    batches.push({ start: i, end: batchEnd });
                }
                
                const results = [];
                for (const batch of batches) {
                    try {
                        const events = await contract.queryFilter(
                            contract.filters[eventName](),
                            batch.start,
                            batch.end
                        );
                        results.push(...events);
                        logger.info(`成功查询 ${eventName} 事件，区块范围: ${batch.start}-${batch.end}`);
                    } catch (error) {
                        logger.error(`查询 ${eventName} 事件失败，区块范围: ${batch.start}-${batch.end}:`, error);
                        // 如果是速率限制错误，等待后重试
                        if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
                            await new Promise(resolve => setTimeout(resolve, this.rateLimit.retryDelay));
                            const events = await contract.queryFilter(
                                contract.filters[eventName](),
                                batch.start,
                                batch.end
                            );
                            results.push(...events);
                        }
                    }
                }
                return results;
            } else {
                // 区块范围在限制内，直接查询
                return await contract.queryFilter(
                    contract.filters[eventName](),
                    fromBlock,
                    toBlock
                );
            }
        } catch (error) {
            logger.error(`查询 ${eventName} 事件失败:`, error);
            throw error;
        }
    }

    // 修改处理TokenListed事件的方法
    async _processTokenListedEvents(fromBlock, toBlock) {
        try {
            if (!this.supportedEvents.TokenListed) {
                logger.info('合约不支持TokenListed事件，跳过处理');
                return;
            }

            logger.info(`查询TokenListed事件, 区块范围: ${fromBlock}-${toBlock}`);
            
            const events = await this._queryEvents(this.marketContract, 'TokenListed', fromBlock, toBlock);
            logger.info(`找到 ${events.length} 个TokenListed事件`);

            for (const event of events) {
                try {
                    const args = event.args;
                    if (args && args.length >= 3) {
                        const tokenId = args[0];
                        const seller = args[1];
                        const price = args[2];
                        await this._handleTokenListed(tokenId, seller, price, event);
                    }
                } catch (err) {
                    logger.error(`处理TokenListed事件失败: ${err.message}`);
                }
            }
        } catch (error) {
            logger.error(`查询TokenListed事件失败: ${error.message}`);
            this.supportedEvents.TokenListed = false;
        }
    }

    // 处理TokenUnlisted事件的历史记录
    async _processTokenUnlistedEvents(fromBlock, toBlock) {
        try {
            // 确保合约支持该事件
            if (!this.supportedEvents.TokenUnlisted) {
                logger.info('合约不支持TokenUnlisted事件，跳过处理');
                return;
            }

            logger.info(`查询TokenUnlisted事件, 区块范围: ${fromBlock}-${toBlock}`);
            
            // 尝试创建过滤器并查询
            let filter;
            try {
                filter = this.academicNFTContract.filters.TokenUnlisted();
            } catch (error) {
                logger.error(`无法创建TokenUnlisted事件过滤器: ${error.message}`);
                this.supportedEvents.TokenUnlisted = false; // 禁用该事件的查询
                return;
            }
            
            // 使用创建的过滤器查询
            const events = await this.academicNFTContract.queryFilter(
                filter,
                fromBlock,
                toBlock
            );

            logger.info(`找到 ${events.length} 个TokenUnlisted事件`);

            for (const event of events) {
                try {
                    const args = event.args;
                    if (args && args.length >= 1) {
                        const tokenId = args[0];

                        await this._handleTokenUnlisted(tokenId, event);
                    }
                } catch (err) {
                    logger.error(`处理TokenUnlisted事件失败: ${err.message}`);
                }
            }
        } catch (error) {
            logger.error(`查询TokenUnlisted事件失败: ${error.message}`);
            // 如果查询失败，也禁用该事件的查询
            this.supportedEvents.TokenUnlisted = false;
        }
    }

    // 修改处理TokenSold事件的方法
    async _processTokenSoldEvents(fromBlock, toBlock) {
        try {
            if (!this.supportedEvents.TokenSold) {
                logger.info('合约不支持TokenSold事件，跳过处理');
                return;
            }

            logger.info(`查询TokenSold事件, 区块范围: ${fromBlock}-${toBlock}`);
            
            const events = await this._queryEvents(this.marketContract, 'TokenSold', fromBlock, toBlock);
            logger.info(`找到 ${events.length} 个TokenSold事件`);

            for (const event of events) {
                try {
                    const args = event.args;
                    if (args && args.length >= 4) {
                        const tokenId = args[0];
                        const seller = args[1];
                        const buyer = args[2];
                        const price = args[3];
                        await this._handleTokenSold(tokenId, buyer, seller, price, event);
                    }
                } catch (err) {
                    logger.error(`处理TokenSold事件失败: ${err.message}`);
                }
            }
        } catch (error) {
            logger.error(`查询TokenSold事件失败: ${error.message}`);
            this.supportedEvents.TokenSold = false;
        }
    }

    // 处理ReferenceCreated事件的历史记录
    async _processReferenceCreatedEvents(fromBlock, toBlock) {
        try {
            // 确保合约支持该事件
            if (!this.supportedEvents.ReferenceCreated) {
                logger.info('合约不支持ReferenceCreated事件，跳过处理');
                return;
            }

            logger.info(`查询ReferenceCreated事件, 区块范围: ${fromBlock}-${toBlock}`);
            
            // 尝试创建过滤器并查询
            let filter;
            try {
                filter = this.academicNFTContract.filters.ReferenceCreated();
            } catch (error) {
                logger.error(`无法创建ReferenceCreated事件过滤器: ${error.message}`);
                this.supportedEvents.ReferenceCreated = false; // 禁用该事件的查询
                return;
            }
            
            // 使用创建的过滤器查询
            const events = await this.academicNFTContract.queryFilter(
                filter,
                fromBlock,
                toBlock
            );

            logger.info(`找到 ${events.length} 个ReferenceCreated事件`);

            for (const event of events) {
                try {
                    const args = event.args;
                    if (args && args.length >= 4) {
                        const referenceId = args[0];
                        const sourceTokenId = args[1];
                        const targetTokenId = args[2];
                        const description = args[3];

                        await this._handleReferenceCreated(referenceId, sourceTokenId, targetTokenId, description, event);
                    }
                } catch (err) {
                    logger.error(`处理ReferenceCreated事件失败: ${err.message}`);
                }
            }
        } catch (error) {
            logger.error(`查询ReferenceCreated事件失败: ${error.message}`);
            // 如果查询失败，也禁用该事件的查询
            this.supportedEvents.ReferenceCreated = false;
        }
    }

    // 处理单个ResourceMinted事件
    async _handleResourceMinted(creator, tokenId, title, description, ipfsHash, resourceType, authors, event) {
        try {
            const tokenIdStr = tokenId.toString();
            const creatorStr = creator.toLowerCase();
            const authorsArray = authors.map(a => a.toLowerCase());

            // 检查NFT是否已存在
            const existingNFT = await NFT.findOne({ tokenId: tokenIdStr });
            
            if (!existingNFT) {
                // 创建新的NFT记录
                const nft = new NFT({
                    tokenId: tokenIdStr,
                    title,
                    description,
                    ipfsHash,
                    resourceType: resourceType.toString(),
                    authors: authorsArray,
                    creator: creatorStr,
                    currentOwner: creatorStr,
                    transfers: [{
                        from: '0x0000000000000000000000000000000000000000',
                        to: creatorStr,
                        timestamp: event.timestamp,
                        blockNumber: event.blockNumber,
                        transactionHash: event.transactionHash
                    }]
                });

                await nft.save();
                logger.info(`创建新的NFT记录: ${tokenIdStr}`);
            } else {
                // 更新现有NFT记录
                const updateData = {
                    title,
                    description,
                    ipfsHash,
                    resourceType: resourceType.toString(),
                    authors: authorsArray,
                    creator: creatorStr,
                    currentOwner: creatorStr
                };

                // 确保transfers数组包含所有必需字段
                if (!existingNFT.transfers || existingNFT.transfers.length === 0) {
                    updateData.transfers = [{
                        from: '0x0000000000000000000000000000000000000000',
                        to: creatorStr,
                        timestamp: event.timestamp,
                        blockNumber: event.blockNumber,
                        transactionHash: event.transactionHash
                    }];
                }

                await NFT.findOneAndUpdate(
                    { tokenId: tokenIdStr },
                    { $set: updateData },
                    { new: true }
                );
                logger.info(`更新NFT记录: ${tokenIdStr}`);
            }

            // 清除相关缓存
            await cacheService.invalidateNFT(tokenIdStr);
            await cacheService.invalidateUserNFTs(creatorStr);
            logger.info(`已清除相关缓存`);

        } catch (error) {
            logger.error('处理ResourceMinted事件失败:', error);
            throw error;
        }
    }

    // 处理单个Transfer事件
    async _handleTransfer(from, to, tokenId, event) {
        try {
            const tokenIdStr = tokenId.toString();
            const fromStr = from.toLowerCase();
            const toStr = to.toLowerCase();

            // 更新NFT记录
            const updateResult = await NFT.findOneAndUpdate(
                { tokenId: tokenIdStr },
                {
                    $set: {
                        currentOwner: toStr
                    },
                    $push: {
                        transfers: {
                            from: fromStr,
                            to: toStr,
                            timestamp: event.timestamp,
                            blockNumber: event.blockNumber,
                            transactionHash: event.transactionHash
                        }
                    }
                },
                { new: true }
            );

            if (updateResult) {
                logger.info(`记录转移事件: ${tokenIdStr} 从 ${fromStr} 到 ${toStr}`);
                
                // 清除相关缓存
                await cacheService.invalidateNFT(tokenIdStr);
                await cacheService.invalidateUserNFTs(fromStr);
                await cacheService.invalidateUserNFTs(toStr);
                logger.info(`已清除相关缓存`);
            } else {
                logger.warn(`未找到要更新的NFT记录: tokenId=${tokenIdStr}`);
            }
        } catch (error) {
            logger.error('处理Transfer事件失败:', error);
            throw error;
        }
    }

    // 处理单个TokenListed事件
    async _handleTokenListed(tokenId, seller, price, event) {
        try {
            const tokenIdStr = tokenId.toString();
            const sellerStr = seller.toLowerCase();
            const blockNumber = event.blockNumber;
            const timestamp = (await this.provider.getBlock(blockNumber)).timestamp * 1000; // 转换为毫秒
            
            // 查找NFT记录
            let nft = await NFT.findOne({ tokenId: tokenIdStr });
            if (nft) {
                // 更新上架信息
                nft.listing = {
                    isActive: true,
                    price: price.toString(),
                    seller: sellerStr,
                    listedAt: new Date(timestamp)
                };

                // 确保所有转移记录都有必需的字段
                if (nft.transfers && nft.transfers.length > 0) {
                    nft.transfers = nft.transfers.map(transfer => ({
                        ...transfer,
                        blockNumber: transfer.blockNumber || blockNumber,
                        transactionHash: transfer.transactionHash || event.transactionHash
                    }));
                }

                await nft.save();
                logger.info(`已更新NFT上架: tokenId=${tokenIdStr}, seller=${seller}, price=${price}`);
            } else {
                logger.warn(`NFT不存在，无法上架: tokenId=${tokenIdStr}`);
            }
            
            // 清除缓存
            await cacheService.invalidateNFT(tokenIdStr);
            await cacheService.invalidateUserNFTs(sellerStr);
            await cacheService.invalidateAllNFTLists();
        } catch (error) {
            logger.error(`处理TokenListed事件失败: tokenId=${tokenId}, error=${error.message}`);
        }
    }

    // 处理单个TokenUnlisted事件
    async _handleTokenUnlisted(tokenId, event) {
        try {
            const tokenIdStr = tokenId.toString();
            const blockNumber = event.blockNumber;
            const timestamp = (await this.provider.getBlock(blockNumber)).timestamp * 1000; // 转换为毫秒

            // 查找NFT记录
            let nft = await NFT.findOne({ tokenId: tokenIdStr });

            if (nft) {
                // 更新上架信息为不活跃
                if (nft.listing) {
                    const seller = nft.listing.seller;
                    nft.listing.isActive = false;
                    
                    await nft.save();
                    logger.info(`已更新NFT下架: tokenId=${tokenIdStr}`);
                    
                    // 清除缓存
                    await cacheService.invalidateNFT(tokenIdStr);
                    await cacheService.invalidateUserNFTs(seller);
                    await cacheService.invalidateAllNFTLists();
                }
            } else {
                logger.warn(`NFT不存在，无法处理下架: tokenId=${tokenIdStr}`);
            }
        } catch (error) {
            logger.error(`处理TokenUnlisted事件失败: tokenId=${tokenId}, error=${error.message}`);
        }
    }

    // 处理单个TokenSold事件
    async _handleTokenSold(tokenId, buyer, seller, price, event) {
        try {
            const tokenIdStr = tokenId.toString();
            const buyerStr = buyer.toLowerCase();
            const sellerStr = seller.toLowerCase();
            const blockNumber = event.blockNumber;
            const timestamp = (await this.provider.getBlock(blockNumber)).timestamp * 1000;

            logger.info(`开始处理TokenSold事件: tokenId=${tokenIdStr}, buyer=${buyer}, seller=${seller}`);

            // 预先清除所有相关缓存
            try {
                await cacheService.invalidateNFT(tokenIdStr);
                await cacheService.invalidateUserNFTs(buyerStr);
                await cacheService.invalidateUserNFTs(sellerStr);
                await cacheService.invalidateMarketList();
                logger.info(`已预先清除所有相关缓存`);
            } catch (cacheError) {
                logger.error(`预先清除缓存失败: ${cacheError.message}`);
            }

            // 查找NFT记录
            let nft = await NFT.findOne({ tokenId: tokenIdStr });
            logger.info(`查找NFT记录结果: ${nft ? '找到' : '未找到'}`);

            if (nft) {
                logger.info(`当前NFT状态: owner=${nft.currentOwner}, listing.active=${nft.listing?.isActive}`);
                
                // 更新上架信息为不活跃
                if (nft.listing) {
                    nft.listing.isActive = false;
                    nft.listing.soldAt = new Date(timestamp);
                    nft.listing.seller = sellerStr;
                    logger.info(`已更新listing状态为不活跃`);
                } else {
                    // 如果没有 listing 记录，创建一个
                    nft.listing = {
                        isActive: false,
                        price: price.toString(),
                        seller: sellerStr,
                        listedAt: new Date(timestamp),
                        soldAt: new Date(timestamp)
                    };
                }
                
                // 更新所有者 - 使用实际的买家地址，而不是市场合约地址
                const oldOwner = nft.currentOwner;
                // 如果买家是市场合约地址，则使用卖家地址作为新的所有者
                const newOwner = buyerStr === contracts.market.address.toLowerCase() ? sellerStr : buyerStr;
                nft.currentOwner = newOwner;
                nft.lastTransferredAt = new Date(timestamp);
                logger.info(`已更新所有者: ${oldOwner} -> ${nft.currentOwner}`);
                
                // 记录销售信息
                if (!nft.sales) {
                    nft.sales = [];
                }
                nft.sales.push({
                    seller: sellerStr,
                    buyer: buyerStr,
                    price: price.toString(),
                    timestamp: new Date(timestamp),
                    blockNumber,
                    transactionHash: event.transactionHash
                });
                logger.info(`已添加销售记录`);

                // 添加转移记录
                nft.transfers.push({
                    from: sellerStr,
                    to: buyerStr,
                    timestamp: new Date(timestamp),
                    blockNumber: blockNumber,
                    transactionHash: event.transactionHash
                });
                logger.info(`已添加转移记录`);

                // 确保所有转移记录都有必需的字段
                if (nft.transfers && nft.transfers.length > 0) {
                    nft.transfers = nft.transfers.map(transfer => ({
                        ...transfer,
                        blockNumber: transfer.blockNumber || blockNumber,
                        transactionHash: transfer.transactionHash || event.transactionHash
                    }));
                }

                try {
                    const savedNft = await nft.save();
                    logger.info(`NFT记录保存成功: ${JSON.stringify(savedNft, null, 2)}`);
                    
                    // 验证保存结果
                    const verifiedNft = await NFT.findOne({ tokenId: tokenIdStr });
                    if (verifiedNft) {
                        logger.info(`验证NFT记录: owner=${verifiedNft.currentOwner}, listing.active=${verifiedNft.listing?.isActive}`);
                    } else {
                        logger.error(`验证失败: 无法找到保存的NFT记录`);
                    }
                } catch (saveError) {
                    logger.error(`保存NFT记录失败: ${saveError.message}`);
                    throw saveError;
                }
                
                // 再次清除所有相关缓存，确保数据完全更新
                try {
                    await cacheService.invalidateNFT(tokenIdStr);
                    await cacheService.invalidateUserNFTs(buyerStr);
                    await cacheService.invalidateUserNFTs(sellerStr);
                    await cacheService.invalidateMarketList();
                    logger.info(`已再次清除所有相关缓存`);
                } catch (cacheError) {
                    logger.error(`再次清除缓存失败: ${cacheError.message}`);
                }
            } else {
                logger.warn(`NFT不存在，无法记录销售: tokenId=${tokenIdStr}`);
            }
        } catch (error) {
            logger.error(`处理TokenSold事件失败: tokenId=${tokenId}, error=${error.message}`);
            throw error;
        }
    }

    // 处理单个ReferenceCreated事件
    async _handleReferenceCreated(referenceId, sourceTokenId, targetTokenId, description, event) {
        try {
            const referenceIdStr = referenceId.toString();
            const sourceTokenIdStr = sourceTokenId.toString();
            const targetTokenIdStr = targetTokenId.toString();
            const blockNumber = event.blockNumber;
            const timestamp = (await this.provider.getBlock(blockNumber)).timestamp * 1000; // 转换为毫秒

            // 查找源NFT记录
            let sourceNft = await NFT.findOne({ tokenId: sourceTokenIdStr });

            if (sourceNft) {
                // 添加引用记录
                if (!sourceNft.references) {
                    sourceNft.references = [];
                }
                
                sourceNft.references.push({
                    referenceId: referenceIdStr,
                    sourceTokenId: sourceTokenIdStr,
                    targetTokenId: targetTokenIdStr,
                    description,
                    timestamp: new Date(timestamp)
                });

                await sourceNft.save();
                logger.info(`已记录NFT引用: referenceId=${referenceIdStr}, sourceTokenId=${sourceTokenIdStr}, targetTokenId=${targetTokenIdStr}`);
                
                // 清除缓存
                await cacheService.invalidateNFT(sourceTokenIdStr);
                await cacheService.invalidateNFT(targetTokenIdStr);
                await cacheService.invalidateAllNFTLists();
            } else {
                logger.warn(`源NFT不存在，无法添加引用: sourceTokenId=${sourceTokenIdStr}`);
            }
        } catch (error) {
            logger.error(`处理ReferenceCreated事件失败: referenceId=${referenceId}, error=${error.message}`);
        }
    }

    // 获取上次处理的区块高度
    async _getLastProcessedBlock() {
        try {
            const deploymentBlock = config.blockchain.deploymentBlock || 0;
            
            // 从数据库读取上次处理的区块高度
            const indexerState = await IndexerState.findOne({ key: 'main' });
            
            if (indexerState) {
                return Math.max(indexerState.lastProcessedBlock, deploymentBlock);
            }
            
            // 如果没有记录，则创建一个
            await IndexerState.create({
                key: 'main',
                lastProcessedBlock: deploymentBlock,
                lastUpdated: new Date()
            });
            
            return deploymentBlock;
        } catch (error) {
            logger.error('获取上次处理的区块高度失败:', error);
            return 0;
        }
    }

    // 保存处理的区块高度
    async _saveLastProcessedBlock(blockNumber) {
        try {
            // 保存处理的区块高度到数据库
            const updated = await IndexerState.findOneAndUpdate(
                { key: 'main' },
                { 
                    lastProcessedBlock: blockNumber,
                    lastUpdated: new Date()
                },
                { upsert: true, new: true }
            );
            
            logger.debug(`更新索引器状态: 区块高度=${updated.lastProcessedBlock}`);
            return true;
        } catch (error) {
            logger.error('保存处理的区块高度失败:', error);
            return false;
        }
    }

    // 同步指定区块范围的事件
    async syncSpecificBlockRange(fromBlock, toBlock) {
        if (this.isIndexing) {
            logger.warn('索引器已在运行，跳过本次同步');
            return false;
        }

        try {
            this.isIndexing = true;
            logger.info(`开始同步指定区块范围: ${fromBlock} - ${toBlock}`);
            
            // 确保provider和合约已初始化
            if (!this.provider || !this.academicNFTContract) {
                logger.error('提供者或合约未初始化，无法同步事件');
                this.isIndexing = false;
                return false;
            }

            // 检查至少有一个事件支持
            if (!Object.values(this.supportedEvents).some(supported => supported)) {
                logger.warn('没有支持的事件，跳过处理');
                this.isIndexing = false;
                return false;
            }

            try {
                // 处理铸造事件
                if (this.supportedEvents.ResourceMinted) {
                    await this._processResourceMintedEvents(fromBlock, toBlock);
                }
                
                // 处理转移事件
                if (this.supportedEvents.Transfer) {
                    await this._processTransferEvents(fromBlock, toBlock);
                }
                
                // 处理上架事件
                if (this.supportedEvents.TokenListed) {
                    await this._processTokenListedEvents(fromBlock, toBlock);
                }
                
                // 处理下架事件
                if (this.supportedEvents.TokenUnlisted) {
                    await this._processTokenUnlistedEvents(fromBlock, toBlock);
                }
                
                // 处理售出事件
                if (this.supportedEvents.TokenSold) {
                    await this._processTokenSoldEvents(fromBlock, toBlock);
                }
                
                // 处理引用事件
                if (this.supportedEvents.ReferenceCreated) {
                    await this._processReferenceCreatedEvents(fromBlock, toBlock);
                }

                // 更新处理进度
                this.lastProcessedBlock = toBlock;
                await this._saveLastProcessedBlock(toBlock);
                
                logger.info(`指定区块范围同步完成: ${fromBlock} - ${toBlock}`);
                this.isIndexing = false;
                return true;
            } catch (error) {
                logger.error(`处理区块范围 ${fromBlock} - ${toBlock} 失败:`, error);
                this.isIndexing = false;
                return false;
            }
        } catch (error) {
            logger.error('同步指定区块范围事件失败:', error);
            this.isIndexing = false;
            return false;
        }
    }
}

export default new BlockchainIndexer(); 