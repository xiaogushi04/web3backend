import crypto from 'crypto';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class EncryptionService {
  constructor() {
    if (!config.encryption?.key) {
      throw new Error('未配置加密密钥，请在环境变量中设置 ENCRYPTION_KEY');
    }
    // 将 base64 编码的密钥转换为 Buffer
    this.encryptionKey = Buffer.from(config.encryption.key, 'base64');
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
      
      // 组合加密后的数据：IV(16字节) + AuthTag长度(2字节) + AuthTag + 加密内容
      const authTagLength = Buffer.alloc(2);
      authTagLength.writeUInt16BE(authTag.length);
      
      const encryptedData = Buffer.concat([
        iv,
        authTagLength,
        authTag,
        encryptedContent
      ]);
      
      return encryptedData;
    } catch (error) {
      logger.error('文件加密失败:', error);
      throw new Error('文件加密失败: ' + error.message);
    }
  }

  // 解密文件
  async decryptFile(encryptedData) {
    try {
      if (!Buffer.isBuffer(encryptedData)) {
        throw new Error('输入数据必须是Buffer类型');
      }

      if (encryptedData.length < 34) { // 最小长度：16(IV) + 2(长度) + 16(最小AuthTag)
        throw new Error('加密数据长度不正确');
      }

      // 从加密数据中提取各个部分
      const iv = encryptedData.slice(0, 16);
      const authTagLength = encryptedData.slice(16, 18).readUInt16BE();
      
      if (authTagLength !== 16) {
        throw new Error('认证标签长度不正确');
      }

      const authTag = encryptedData.slice(18, 18 + authTagLength);
      const encryptedContent = encryptedData.slice(18 + authTagLength);
      
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
      throw new Error('文件解密失败: ' + error.message);
    }
  }
}

export default new EncryptionService(); 