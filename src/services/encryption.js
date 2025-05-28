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
    logger.info('加密服务初始化完成，密钥信息:', {
      keyBase64: config.encryption.key,
      keyLength: this.encryptionKey.length,
      keyHex: this.encryptionKey.toString('hex')
    });
  }

  // 加密文件
  async encryptFile(fileBuffer) {
    try {
      logger.info('开始加密文件，文件大小:', fileBuffer.length);
      
      // 生成随机初始化向量
      const iv = crypto.randomBytes(16);
      logger.info('生成IV:', iv.toString('hex'));
      
      // 创建加密器
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      // 加密文件内容
      const encryptedContent = Buffer.concat([
        cipher.update(fileBuffer),
        cipher.final()
      ]);
      
      // 获取认证标签
      const authTag = cipher.getAuthTag();
      logger.info('认证标签长度:', authTag.length);
      
      // 组合加密后的数据：IV(16字节) + AuthTag长度(2字节) + AuthTag + 加密内容
      const authTagLength = Buffer.alloc(2);
      authTagLength.writeUInt16BE(authTag.length);
      
      const encryptedData = Buffer.concat([
        iv,
        authTagLength,
        authTag,
        encryptedContent
      ]);
      
      logger.info('加密完成，总数据大小:', encryptedData.length);
      return encryptedData;
    } catch (error) {
      logger.error('文件加密失败:', error);
      throw new Error('文件加密失败: ' + error.message);
    }
  }

  // 解密文件
  async decryptFile(encryptedData) {
    try {
      logger.info('开始解密文件，加密数据大小:', encryptedData.length);
      
      if (!Buffer.isBuffer(encryptedData)) {
        throw new Error('输入数据必须是Buffer类型');
      }

      if (encryptedData.length < 34) { // 最小长度：16(IV) + 2(长度) + 16(最小AuthTag)
        throw new Error('加密数据长度不正确');
      }

      // 从加密数据中提取各个部分
      const iv = encryptedData.slice(0, 16);
      logger.info('提取IV:', iv.toString('hex'));
      
      const authTagLength = encryptedData.slice(16, 18).readUInt16BE();
      logger.info('认证标签长度:', authTagLength);
      
      if (authTagLength < 12 || authTagLength > 16) {
        throw new Error('认证标签长度不正确');
      }

      const authTag = encryptedData.slice(18, 18 + authTagLength);
      logger.info('提取认证标签:', authTag.toString('hex'));
      
      const encryptedContent = encryptedData.slice(18 + authTagLength);
      logger.info('加密内容大小:', encryptedContent.length);
      
      // 创建解密器
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      // 解密内容
      const decryptedContent = Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final()
      ]);
      
      logger.info('解密完成，解密后数据大小:', decryptedContent.length);
      return decryptedContent;
    } catch (error) {
      logger.error('文件解密失败:', error);
      throw new Error('文件解密失败: ' + error.message);
    }
  }
}

export default new EncryptionService(); 