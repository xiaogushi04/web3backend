import express from 'express';
import multer from 'multer';
import uploadController from './controller.js';
import { authenticate } from '../auth/middleware.js';

const router = express.Router();

// 配置 multer 内存存储
const upload = multer({ storage: multer.memoryStorage() });

// 上传文件
router.post('/file', 
  authenticate,
  upload.single('file'),
  uploadController.uploadFile
);

// 获取文件
router.get('/file/:cid',
  authenticate,
  uploadController.getFile
);

export default router; 