import crypto from 'crypto';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class EncryptionService {
  constructor() {
    // 从配置中获取加密密钥，如果没有则生成一个
    this.encryptionKey = config.encryption?.key || crypto.randomBytes(32);
    this.algorithm = 'aes-256-gcm';
  }

  // 加密文件
  async encryptFile(fileBuffer) {
    try {
      // 生成随机初始化向量
      const iv = crypto.randomBytes(16);
      
      // 创建加密器
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      // 加密文件内容
      const encryptedContent = Buffer.concat([
        cipher.update(fileBuffer),
        cipher.final()
      ]);
      
      // 获取认证标签
      const authTag = cipher.getAuthTag();
      
      // 组合加密后的数据：IV + 认证标签 + 加密内容
      const encryptedData = Buffer.concat([iv, authTag, encryptedContent]);
      
      return encryptedData;
    } catch (error) {
      logger.error('文件加密失败:', error);
      throw new Error('文件加密失败');
    }
  }

  // 解密文件
  async decryptFile(encryptedData) {
    try {
      // 从加密数据中提取IV、认证标签和加密内容
      const iv = encryptedData.slice(0, 16);
      const authTag = encryptedData.slice(16, 32);
      const encryptedContent = encryptedData.slice(32);
      
      // 创建解密器
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      // 解密内容
      const decryptedContent = Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final()
      ]);
      
      return decryptedContent;
    } catch (error) {
      logger.error('文件解密失败:', error);
      throw new Error('文件解密失败');
    }
  }
}

export default new EncryptionService(); 