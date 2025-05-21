import { ethers } from 'ethers';
import logger from '../utils/logger.js';

export const verifySignature = async (req, res, next) => {
    const signature = req.headers['x-signature'];
    // 尝试从 body 或 query 中获取 message 和 address
    // 这使得中间件更灵活，可以处理 GET 和 POST 请求
    const message = req.body.message || req.query.message;
    const address = req.body.address || req.query.address || req.body.userAddress || req.query.userAddress;

    logger.info(`[AuthMiddleware] verifySignature: Received request. Headers: x-signature=${signature ? 'present' : 'missing'}`);
    logger.info(`[AuthMiddleware] verifySignature: Received message: '${message}', address: '${address}'`);

    if (!signature || !message || !address) {
        logger.warn('[AuthMiddleware] verifySignature: Missing signature, message, or address.');
        return res.status(401).json({ message: 'Missing signature, message, or address for verification.' });
    }

    try {
        const signerAddress = ethers.verifyMessage(message, signature);
        logger.info(`[AuthMiddleware] verifySignature: Signature decrypted. Signer address: ${signerAddress}`);

        if (signerAddress.toLowerCase() !== address.toLowerCase()) {
            logger.warn(`[AuthMiddleware] verifySignature: Signature verification failed. Expected address: ${address}, but got signer: ${signerAddress}`);
            return res.status(401).json({ message: 'Signature verification failed: Signer does not match address.' });
        }

        logger.info(`[AuthMiddleware] verifySignature: Signature verified successfully for address: ${address}`);
        req.userAddress = signerAddress; // 将验证后的用户地址附加到请求对象，供后续处理程序使用
        next();
    } catch (error) {
        logger.error('[AuthMiddleware] verifySignature: Error during signature verification:', error);
        return res.status(401).json({ message: 'Invalid signature or error during verification.', error: error.message });
    }
}; 