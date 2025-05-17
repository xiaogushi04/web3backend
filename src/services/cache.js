import { createClient } from 'redis';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import Redis from 'ioredis';

class CacheService {
  constructor() {
    this.redis = null;
    this.initialize();
  }

  async initialize() {
    try {
      this.redis = new Redis(config.redis);
      logger.info('Redis连接成功');
    } catch (error) {
      logger.error('Redis连接失败:', error);
    }
  }

  async connect() {
    try {
      if (this.redis) {
        logger.debug('Redis已连接');
        return;
      }

      this.redis = createClient({
        url: config.redis.url,
        password: config.redis.password
      });

      this.redis.on('error', (err) => {
        logger.error('Redis错误:', err);
      });

      this.redis.on('connect', () => {
        logger.info('Redis已连接');
      });

      await this.redis.connect();
    } catch (error) {
      logger.error('Redis连接失败:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.redis) {
        await this.redis.quit();
        logger.info('Redis连接已关闭');
      }
    } catch (error) {
      logger.error('Redis断开连接失败:', error);
      throw error;
    }
  }

  async get(key) {
    try {
      if (!this.redis) await this.connect();
      return await this.redis.get(key);
    } catch (error) {
      logger.error(`获取缓存失败[${key}]:`, error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      if (!this.redis) await this.connect();
      await this.redis.set(key, value);
      if (ttl > 0) {
        await this.redis.expire(key, ttl);
      }
      return true;
    } catch (error) {
      logger.error(`设置缓存失败[${key}]:`, error);
      return false;
    }
  }

  async del(key) {
    try {
      if (!this.redis) await this.connect();
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error(`删除缓存失败[${key}]:`, error);
      return false;
    }
  }

  async delByPattern(pattern) {
    try {
      if (!this.redis) await this.connect();
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
        logger.debug(`批量删除缓存[${pattern}], 共${keys.length}个`);
      }
      return keys.length;
    } catch (error) {
      logger.error(`批量删除缓存失败[${pattern}]:`, error);
      return 0;
    }
  }

  async cacheNFTList(key, data, ttl = 300) {
    try {
      await this.redis.set(key, JSON.stringify(data), 'EX', ttl);
      logger.debug(`已缓存NFT列表: ${key}, TTL: ${ttl}秒`);
      return true;
    } catch (error) {
      logger.error(`缓存NFT列表失败: ${error.message}`);
      return false;
    }
  }

  async getNFTList(key) {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`获取NFT列表缓存失败: ${error.message}`);
      return null;
    }
  }

  async invalidateNFT(tokenId) {
    try {
      const key = `nft:${tokenId}`;
      await this.redis.del(key);
      logger.debug(`已清除NFT缓存: ${key}`);
    } catch (error) {
      logger.error(`清除NFT缓存失败: ${error.message}`);
    }
  }

  async invalidateUserNFTs(userAddress) {
    try {
      // 清除所有与该用户相关的缓存
      const pattern = `nft:user:${userAddress.toLowerCase()}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
        logger.debug(`已清除用户NFT列表缓存: ${keys.length} 个键`);
      }
    } catch (error) {
      logger.error(`清除用户NFT列表缓存失败: ${error.message}`);
    }
  }

  async invalidateAllNFTLists() {
    try {
      // 清除所有市场列表缓存
      const marketKeys = await this.redis.keys('nft:market:*');
      if (marketKeys.length > 0) {
        await this.redis.del(marketKeys);
        logger.debug(`已清除市场列表缓存: ${marketKeys.length} 个键`);
      }

      // 清除所有用户NFT列表缓存
      const userKeys = await this.redis.keys('nft:user:*');
      if (userKeys.length > 0) {
        await this.redis.del(userKeys);
        logger.debug(`已清除用户NFT列表缓存: ${userKeys.length} 个键`);
      }

      // 清除所有NFT详情缓存
      const nftKeys = await this.redis.keys('nft:*');
      if (nftKeys.length > 0) {
        await this.redis.del(nftKeys);
        logger.debug(`已清除NFT详情缓存: ${nftKeys.length} 个键`);
      }

      // 清除所有列表缓存
      const listKeys = await this.redis.keys('nft:list:*');
      if (listKeys.length > 0) {
        await this.redis.del(listKeys);
        logger.debug(`已清除列表缓存: ${listKeys.length} 个键`);
      }
    } catch (error) {
      logger.error(`清除所有NFT列表缓存失败: ${error.message}`);
    }
  }

  async invalidateMarketList() {
    try {
      // 清除所有市场列表缓存
      const marketKeys = await this.redis.keys('nft:market:*');
      if (marketKeys.length > 0) {
        await this.redis.del(marketKeys);
        logger.debug(`已清除市场列表缓存: ${marketKeys.length} 个键`);
      }

      // 清除所有NFT详情缓存，因为市场列表可能包含这些NFT
      const nftKeys = await this.redis.keys('nft:*');
      if (nftKeys.length > 0) {
        await this.redis.del(nftKeys);
        logger.debug(`已清除NFT详情缓存: ${nftKeys.length} 个键`);
      }

      // 清除所有列表缓存
      const listKeys = await this.redis.keys('nft:list:*');
      if (listKeys.length > 0) {
        await this.redis.del(listKeys);
        logger.debug(`已清除列表缓存: ${listKeys.length} 个键`);
      }
    } catch (error) {
      logger.error(`清除市场列表缓存失败: ${error.message}`);
    }
  }
}

export default new CacheService(); 