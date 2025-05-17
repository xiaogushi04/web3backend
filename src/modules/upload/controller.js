import ipfsService from '../../services/ipfs.js';
import Resource from '../../models/resource.js';

class UploadController {
  async uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: '未提供文件'
        });
      }

      // 上传文件到 IPFS
      const { cid, size } = await ipfsService.uploadFile(req.file.buffer);

      // 固定文件
      await ipfsService.pinFile(cid);

      // 创建资源记录
      const resource = await Resource.create({
        cid,
        size,
        owner: req.user.address,
        filename: req.file.originalname,
        mimetype: req.file.mimetype
      });

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
      const fileBuffer = await ipfsService.getFile(cid);
      
      res.set('Content-Type', 'application/octet-stream');
      res.send(fileBuffer);
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