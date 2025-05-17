import { ethers } from 'ethers';
import config from '../config/config.js';
import contracts from '../config/contracts.js';
import logger from '../utils/logger.js';

class BlockchainService {
  constructor() {
    this.provider = null;
    this.contracts = {};
    this.retryCount = 0;
    this.maxRetries = 5;
    this.baseDelay = 5000; // 基础延迟5秒
    this.maxDelay = 30000; // 最大延迟30秒
    this.initialize();
  }

  async initialize() {
    try {
      // 连接到以太坊网络，禁用内置重试机制
      this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl, undefined, {
        timeout: 30000, // 30秒超时
        retry: false // 禁用内置重试
      });
      
      // 测试连接
      await this.provider.getNetwork();
      logger.info('RPC连接测试成功');
      
      // 初始化合约实例
      Object.entries(contracts).forEach(([key, contract]) => {
        if (contract.address && contract.abi) {
          this.contracts[key] = new ethers.Contract(
            contract.address,
            contract.abi,
            this.provider
          );
          logger.info(`${contract.name} 合约初始化成功`);
        } else {
          logger.warn(`${contract.name} 合约未配置`);
        }
      });

      logger.info('区块链服务初始化成功');
      this.retryCount = 0; // 重置重试计数
    } catch (error) {
      logger.error('区块链服务初始化失败:', error);
      
      // 使用指数退避重试，但限制最大延迟时间
      if (this.retryCount < this.maxRetries) {
        const delay = Math.min(
          this.baseDelay * Math.pow(2, this.retryCount),
          this.maxDelay
        );
        this.retryCount++;
        logger.info(`将在 ${delay/1000} 秒后重试 (第 ${this.retryCount} 次)`);
        
        // 使用 Promise 包装 setTimeout
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.initialize();
      } else {
        logger.error('达到最大重试次数，请检查网络连接和RPC配置');
        throw new Error('区块链服务初始化失败，请检查网络连接和RPC配置');
      }
    }
  }

  // 添加重连方法
  async reconnect() {
    logger.info('尝试重新连接区块链服务...');
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
      logger.error('区块链服务健康检查失败:', error);
      return false;
    }
  }

  async verifySignature(address, message, signature) {
    try {
      const signerAddr = ethers.verifyMessage(message, signature);
      return signerAddr.toLowerCase() === address.toLowerCase();
    } catch (error) {
      logger.error('签名验证失败:', error);
      return false;
    }
  }

  // AcademicNFT 合约方法
  async mintResource(to, title, description, ipfsHash, resourceType, authors) {
    try {
      if (!this.contracts.academicNFT) {
        throw new Error('AcademicNFT 合约未初始化');
      }

      const tx = await this.contracts.academicNFT.mintResource(
        to,
        title,
        description,
        ipfsHash,
        resourceType,
        authors
      );
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === 'ResourceMinted');
      const tokenId = event.args.tokenId.toString();

      return {
        tokenId,
        transactionHash: receipt.transactionHash
      };
    } catch (error) {
      logger.error('学术资源铸造失败:', error);
      throw error;
    }
  }

  async getResourceMetadata(tokenId) {
    try {
      if (!this.contracts.academicNFT) {
        throw new Error('AcademicNFT 合约未初始化');
      }

      const metadata = await this.contracts.academicNFT.getResourceMetadata(tokenId);
      return {
        title: metadata[0],
        description: metadata[1],
        ipfsHash: metadata[2],
        resourceType: metadata[3],
        authors: metadata[4],
        timestamp: metadata[5].toString()
      };
    } catch (error) {
      logger.error('获取资源元数据失败:', error);
      throw error;
    }
  }

  async getAuthorResources(author) {
    try {
      if (!this.contracts.academicNFT) {
        throw new Error('AcademicNFT 合约未初始化');
      }

      return await this.contracts.academicNFT.getAuthorResources(author);
    } catch (error) {
      logger.error('获取作者资源失败:', error);
      throw error;
    }
  }

  // Reference 合约方法
  async createReference(sourceTokenId, targetTokenId, description) {
    try {
      if (!this.contracts.reference) {
        throw new Error('Reference 合约未初始化');
      }

      const tx = await this.contracts.reference.createReference(
        sourceTokenId,
        targetTokenId,
        description
      );
      const receipt = await tx.wait();

      const event = receipt.events.find(e => e.event === 'ReferenceCreated');
      const referenceId = event.args.referenceId.toString();

      return {
        referenceId,
        transactionHash: receipt.transactionHash
      };
    } catch (error) {
      logger.error('创建引用失败:', error);
      throw error;
    }
  }

  async getReference(referenceId) {
    try {
      if (!this.contracts.reference) {
        throw new Error('Reference 合约未初始化');
      }

      const reference = await this.contracts.reference.getReference(referenceId);
      return {
        id: reference[0].toString(),
        sourceTokenId: reference[1].toString(),
        targetTokenId: reference[2].toString(),
        referencer: reference[3],
        description: reference[4],
        timestamp: reference[5].toString(),
        isValid: reference[6]
      };
    } catch (error) {
      logger.error('获取引用详情失败:', error);
      throw error;
    }
  }

  async getResourceReferences(tokenId) {
    try {
      if (!this.contracts.reference) {
        throw new Error('Reference 合约未初始化');
      }

      return await this.contracts.reference.getResourceReferences(tokenId);
    } catch (error) {
      logger.error('获取资源引用失败:', error);
      throw error;
    }
  }

  async getValidReferenceCount(tokenId) {
    try {
      if (!this.contracts.reference) {
        throw new Error('Reference 合约未初始化');
      }

      return await this.contracts.reference.getValidReferenceCount(tokenId);
    } catch (error) {
      logger.error('获取有效引用数量失败:', error);
      throw error;
    }
  }

  // Market 合约方法
  async listResource(tokenId, price) {
    try {
      if (!this.contracts.market) {
        throw new Error('Market 合约未初始化');
      }

      const tx = await this.contracts.market.listToken(tokenId, price);
      const receipt = await tx.wait();

      const event = receipt.events.find(e => e.event === 'TokenListed');
      return {
        transactionHash: receipt.transactionHash,
        tokenId: event.args.tokenId.toString(),
        seller: event.args.seller,
        price: event.args.price.toString()
      };
    } catch (error) {
      logger.error('资源上架失败:', error);
      throw error;
    }
  }

  async buyResource(tokenId, price) {
    try {
      if (!this.contracts.market) {
        throw new Error('Market 合约未初始化');
      }

      const tx = await this.contracts.market.buyToken(tokenId, {
        value: price
      });
      const receipt = await tx.wait();

      const event = receipt.events.find(e => e.event === 'TokenSold');
      return {
        transactionHash: receipt.transactionHash,
        tokenId: event.args.tokenId.toString(),
        seller: event.args.seller,
        buyer: event.args.buyer,
        price: event.args.price.toString()
      };
    } catch (error) {
      logger.error('资源购买失败:', error);
      throw error;
    }
  }

  async cancelListing(tokenId) {
    try {
      if (!this.contracts.market) {
        throw new Error('Market 合约未初始化');
      }

      const tx = await this.contracts.market.cancelListing(tokenId);
      const receipt = await tx.wait();

      const event = receipt.events.find(e => e.event === 'ListingCancelled');
      return {
        transactionHash: receipt.transactionHash,
        tokenId: event.args.tokenId.toString(),
        seller: event.args.seller
      };
    } catch (error) {
      logger.error('取消上架失败:', error);
      throw error;
    }
  }

  async getListing(tokenId) {
    try {
      if (!this.contracts.market) {
        throw new Error('Market 合约未初始化');
      }

      const listing = await this.contracts.market.getListing(tokenId);
      return {
        seller: listing[0],
        price: listing[1].toString(),
        isActive: listing[2],
        timestamp: listing[3].toString()
      };
    } catch (error) {
      logger.error('获取上架信息失败:', error);
      throw error;
    }
  }

  async getUserListings(user) {
    try {
      if (!this.contracts.market) {
        throw new Error('Market 合约未初始化');
      }

      return await this.contracts.market.getUserListings(user);
    } catch (error) {
      logger.error('获取用户上架列表失败:', error);
      throw error;
    }
  }
}

export default new BlockchainService(); 