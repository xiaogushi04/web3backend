import { create } from 'kubo-rpc-client';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class IPFSService {
  constructor() {
    this.ipfs = null;
    this.initialize();
  }

  initialize() {
    try {
      // 使用远程Kubo节点的配置
      this.ipfs = create({
        host: config.ipfs.host,
        port: config.ipfs.port,
        protocol: config.ipfs.protocol,
        timeout: 30000, // 增加超时时间到30秒
        headers: {
          'Authorization': `Basic ${Buffer.from(`${config.ipfs.projectId}:${config.ipfs.projectSecret}`).toString('base64')}`
        }
      });
      logger.info('IPFS 服务连接成功');
    } catch (error) {
      logger.error('IPFS 服务连接失败:', error);
      throw error;
    }
  }

  async uploadFile(file) {
    try {
      if (!this.ipfs) {
        throw new Error('IPFS 服务未初始化');
      }

      const result = await this.ipfs.add(file);
      logger.info('IPFS add 结果:', result);

      if (!result) {
        throw new Error('IPFS 上传失败：未返回结果');
      }

      if (!result.cid) {
        throw new Error('IPFS 上传失败：结果中未包含 CID');
      }

      const cid = result.cid.toString();
      logger.info('CID 字符串:', cid);

      if (!cid || cid.length < 10) {
        throw new Error(`IPFS 上传失败：无效的 CID 格式: ${cid}`);
      }

      return {
        cid,
        size: result.size
      };
    } catch (error) {
      logger.error('文件上传失败:', error);
      throw error;
    }
  }

  async getFile(cid) {
    try {
      if (!this.ipfs) {
        throw new Error('IPFS 服务未初始化');
      }

      const chunks = [];
      for await (const chunk of this.ipfs.cat(cid)) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      logger.error('文件获取失败:', error);
      throw error;
    }
  }

  async pinFile(cid) {
    try {
      if (!this.ipfs) {
        throw new Error('IPFS 服务未初始化');
      }

      // 添加重试逻辑
      let retries = 3;
      let lastError;

      while (retries > 0) {
        try {
          await this.ipfs.pin.add(cid);
          logger.info(`文件已固定到IPFS: ${cid}`);
          return true;
        } catch (error) {
          lastError = error;
          retries--;
          if (retries > 0) {
            logger.warn(`固定文件失败，剩余重试次数: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒后重试
          }
        }
      }

      throw lastError;
    } catch (error) {
      logger.error('文件固定失败:', error);
      throw error;
    }
  }
}

// 导出单例实例
export default new IPFSService(); 