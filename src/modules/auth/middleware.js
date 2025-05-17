import jwt from 'jsonwebtoken';
import config from '../../config/config.js';

export const validateSignature = async (req, res, next) => {
  try {
    const { address, signature } = req.body;
    if (!address || !signature) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要参数'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '签名验证失败'
    });
  }
};

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: '未提供认证令牌'
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: '无效的认证令牌'
    });
  }
}; 