const express = require('express');
const router = express.Router();
const authController = require('./controller');
const { validateSignature } = require('./middleware');

// 钱包登录
router.post('/login', validateSignature, authController.login);

// 刷新令牌
router.post('/refresh', authController.refreshToken);

// 获取用户信息
router.get('/me', authController.getUserInfo);

module.exports = router; 