import dotenv from 'dotenv';
dotenv.config();

export const config = {
    // 网络配置
    sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL || '',
    privateKey: process.env.PRIVATE_KEY || '',

    // 合约地址
    academicNFTAddress: process.env.ACADEMIC_NFT_ADDRESS || '',
    referenceAddress: process.env.REFERENCE_RECORD_ADDRESS || '',
    marketAddress: process.env.ACADEMIC_MARKET_ADDRESS || '',

    // 服务器配置
    port: process.env.PORT || 3000,
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/academic-market',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret'
}; 