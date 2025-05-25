import ipfsService from '../../services/ipfs.js';
import encryptionService from '../../services/encryption.js';
import Resource from '../../models/resource.js';
import logger from '../../utils/logger.js';

class UploadController {
  async uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: '未提供文件'
        });
      }

      logger.info('开始处理文件上传:', {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      // 加密文件
      logger.info('开始加密文件...');
      const encryptedFile = await encryptionService.encryptFile(req.file.buffer);
      logger.info('文件加密完成');

      // 上传加密后的文件到 IPFS
      logger.info('开始上传文件到 IPFS...');
      const { cid, size } = await ipfsService.uploadFile(encryptedFile);
      logger.info('文件上传到 IPFS 完成:', { cid, size });

      // 固定文件
      logger.info('开始固定文件...');
      await ipfsService.pinFile(cid);
      logger.info('文件固定完成');

      // 创建资源记录
      const resource = await Resource.create({
        cid,
        size,
        owner: req.user.address,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        isEncrypted: true // 标记文件已加密
      });

      logger.info('资源记录创建成功:', { resourceId: resource._id });

      res.json({
        status: 'success',
        data: {
          cid,
          size,
          resourceId: resource._id
        }
      });
    } catch (error) {
      console.error('文件上传失败:', error);
      res.status(500).json({
        status: 'error',
        message: '文件上传失败'
      });
    }
  }

  async getFile(req, res) {
    try {
      const { cid } = req.params;
      logger.info('开始获取文件:', { cid });

      // 从 IPFS 获取加密的文件
      const encryptedFile = await ipfsService.getFile(cid);
      logger.info('从 IPFS 获取文件成功');

      // 解密文件
      logger.info('开始解密文件...');
      const decryptedFile = await encryptionService.decryptFile(encryptedFile);
      logger.info('文件解密完成');

      // 获取资源信息以设置正确的 Content-Type
      const resource = await Resource.findOne({ cid });
      if (resource) {
        res.set('Content-Type', resource.mimetype);
        res.set('Content-Disposition', `attachment; filename="${resource.filename}"`);
      } else {
        res.set('Content-Type', 'application/octet-stream');
      }

      res.send(decryptedFile);
      logger.info('文件发送完成');
    } catch (error) {
      console.error('文件获取失败:', error);
      res.status(500).json({
        status: 'error',
        message: '文件获取失败'
      });
    }
  }
}

export default new UploadController(); 