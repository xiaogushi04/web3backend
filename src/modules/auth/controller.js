import jwt from 'jsonwebtoken';
import config from '../../config/config.js';
import User from '../../models/user.js';

class AuthController {
  async login(req, res) {
    try {
      const { address, signature } = req.body;
      
      // 验证签名
      const isValid = await this.verifySignature(address, signature);
      if (!isValid) {
        return res.status(401).json({
          status: 'error',
          message: '签名验证失败'
        });
      }

      // 查找或创建用户
      let user = await User.findOne({ address });
      if (!user) {
        user = await User.create({ address });
      }

      // 生成 JWT
      const token = jwt.sign(
        { address: user.address },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({
        status: 'success',
        data: {
          token,
          user: {
            address: user.address,
            username: user.username
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        status: 'error',
        message: '登录失败'
      });
    }
  }

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      // 实现令牌刷新逻辑
      res.json({
        status: 'success',
        message: '令牌刷新成功'
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: '令牌刷新失败'
      });
    }
  }

  async getUserInfo(req, res) {
    try {
      const { address } = req.user;
      const user = await User.findOne({ address });
      
      res.json({
        status: 'success',
        data: {
          address: user.address,
          username: user.username,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: '获取用户信息失败'
      });
    }
  }

  async verifySignature(address, signature) {
    // 实现签名验证逻辑
    return true; // 临时返回
  }
}

export default new AuthController(); 