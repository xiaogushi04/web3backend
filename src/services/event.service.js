const logger = require('../utils/logger');
const NFT = require('../models/nft.model');
const AccessToken = require('../models/access-token.model');
const cache = require('../utils/cache');

class EventService {
  constructor() {
    this.processedEvents = new Set();
  }

  async handleTokenSold(tokenId, seller, buyer, price, event) {
    try {
      const eventId = `${event.transactionHash}-${event.logIndex}`;
      if (this.processedEvents.has(eventId)) {
        logger.info('TokenSold event already processed:', eventId);
        return;
      }

      logger.info('Processing TokenSold event:', {
        tokenId: tokenId.toString(),
        seller,
        buyer,
        price: price.toString(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });

      // 更新 NFT 状态
      await NFT.findOneAndUpdate(
        { tokenId: tokenId.toString() },
        {
          owner: buyer,
          isListed: false,
          price: '0',
          lastTransactionHash: event.transactionHash,
          lastBlockNumber: event.blockNumber
        },
        { new: true }
      );

      // 清除缓存
      await cache.del(`nft:${tokenId}`);
      await cache.del('market:list');

      this.processedEvents.add(eventId);
      logger.info('TokenSold event processed successfully');
    } catch (error) {
      logger.error('Failed to process TokenSold event:', error);
      throw error;
    }
  }

  async handleTokenListed(tokenId, seller, price, event) {
    try {
      const eventId = `${event.transactionHash}-${event.logIndex}`;
      if (this.processedEvents.has(eventId)) {
        logger.info('TokenListed event already processed:', eventId);
        return;
      }

      logger.info('Processing TokenListed event:', {
        tokenId: tokenId.toString(),
        seller,
        price: price.toString(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });

      // 更新 NFT 状态
      await NFT.findOneAndUpdate(
        { tokenId: tokenId.toString() },
        {
          isListed: true,
          price: price.toString(),
          lastTransactionHash: event.transactionHash,
          lastBlockNumber: event.blockNumber
        },
        { new: true }
      );

      // 清除缓存
      await cache.del(`nft:${tokenId}`);
      await cache.del('market:list');

      this.processedEvents.add(eventId);
      logger.info('TokenListed event processed successfully');
    } catch (error) {
      logger.error('Failed to process TokenListed event:', error);
      throw error;
    }
  }

  async handleAccessTokenSold(resourceId, buyer, accessTokenId, price, event) {
    try {
      const eventId = `${event.transactionHash}-${event.logIndex}`;
      if (this.processedEvents.has(eventId)) {
        logger.info('AccessTokenSold event already processed:', eventId);
        return;
      }

      logger.info('Processing AccessTokenSold event:', {
        resourceId: resourceId.toString(),
        buyer,
        accessTokenId: accessTokenId.toString(),
        price: price.toString(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });

      // 获取访问权元数据
      const metadata = await this.contractService.accessTokenContract.getAccessMetadata(accessTokenId);
      
      // 创建访问权记录
      const accessToken = new AccessToken({
        tokenId: accessTokenId.toString(),
        resourceId: resourceId.toString(),
        owner: buyer,
        price: price.toString(),
        accessType: metadata.accessType,
        expiryTime: new Date(Number(metadata.expiryTime) * 1000),
        maxUses: metadata.maxUses.toString(),
        usedCount: metadata.usedCount.toString(),
        isActive: metadata.isActive,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });
      await accessToken.save();

      // 清除缓存
      await cache.del(`access:${accessTokenId}`);
      await cache.del(`resource:${resourceId}:access`);

      this.processedEvents.add(eventId);
      logger.info('AccessTokenSold event processed successfully');
    } catch (error) {
      logger.error('Failed to process AccessTokenSold event:', error);
      throw error;
    }
  }

  async handleAccessTokenUsed(accessTokenId, event) {
    try {
      const eventId = `${event.transactionHash}-${event.logIndex}`;
      if (this.processedEvents.has(eventId)) {
        logger.info('AccessTokenUsed event already processed:', eventId);
        return;
      }

      logger.info('Processing AccessTokenUsed event:', {
        accessTokenId: accessTokenId.toString(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });

      // 更新访问权使用次数
      const accessToken = await AccessToken.findOneAndUpdate(
        { tokenId: accessTokenId.toString() },
        { $inc: { usedCount: 1 } },
        { new: true }
      );

      if (!accessToken) {
        throw new Error('Access token not found');
      }

      // 检查是否达到最大使用次数
      if (accessToken.usedCount >= accessToken.maxUses) {
        accessToken.isActive = false;
        await accessToken.save();
      }

      // 清除缓存
      await cache.del(`access:${accessTokenId}`);

      this.processedEvents.add(eventId);
      logger.info('AccessTokenUsed event processed successfully');
    } catch (error) {
      logger.error('Failed to process AccessTokenUsed event:', error);
      throw error;
    }
  }

  async handleAccessTokenBurned(accessTokenId, event) {
    try {
      const eventId = `${event.transactionHash}-${event.logIndex}`;
      if (this.processedEvents.has(eventId)) {
        logger.info('AccessTokenBurned event already processed:', eventId);
        return;
      }

      logger.info('Processing AccessTokenBurned event:', {
        accessTokenId: accessTokenId.toString(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });

      // 更新访问权状态
      await AccessToken.findOneAndUpdate(
        { tokenId: accessTokenId.toString() },
        { isActive: false }
      );

      // 清除缓存
      await cache.del(`access:${accessTokenId}`);

      this.processedEvents.add(eventId);
      logger.info('AccessTokenBurned event processed successfully');
    } catch (error) {
      logger.error('Failed to process AccessTokenBurned event:', error);
      throw error;
    }
  }
}

module.exports = new EventService(); 