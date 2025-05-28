import dotenv from 'dotenv';
dotenv.config();

// 添加调试日志
console.log('环境变量检查:');
console.log('MARKET_CONTRACT_ADDRESS:', process.env.MARKET_CONTRACT_ADDRESS);
console.log('ACADEMIC_NFT_CONTRACT_ADDRESS:', process.env.ACADEMIC_NFT_CONTRACT_ADDRESS);
console.log('REFERENCE_CONTRACT_ADDRESS:', process.env.REFERENCE_CONTRACT_ADDRESS);
console.log('ACCESS_TOKEN_ADDRESS:', process.env.ACCESS_TOKEN_ADDRESS);

const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    host: process.env.HOST || 'localhost'
  },

  // 数据库配置
  database: {
    mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/web3docmarket',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },

  // 向后兼容旧配置
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/web3docmarket'
  },

  // Redis配置
  redis: {
    url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    ttl: 60 * 60 // 默认缓存时间为1小时
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },

  // IPFS配置
  ipfs: {
    host: process.env.IPFS_HOST || '13.71.157.247',
    port: process.env.IPFS_PORT || 5043,
    protocol: process.env.IPFS_PROTOCOL || 'http',
    projectId: process.env.IPFS_PROJECT_ID || '',
    projectSecret: process.env.IPFS_PROJECT_SECRET || '',
    apiUrl: process.env.IPFS_API_URL || 'http://13.71.157.247:5043',
    gatewayUrl: process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs'
  },

  // 区块链配置
  blockchain: {
    rpcUrl: process.env.RPC_URL || 'http://localhost:7545',  // Ganache默认端口
    privateKey: process.env.PRIVATE_KEY_LOCAL || '',
    academicNFTAddress: process.env.ACADEMIC_NFT_CONTRACT_ADDRESS,
    referenceAddress: process.env.REFERENCE_CONTRACT_ADDRESS,
    marketAddress: process.env.MARKET_CONTRACT_ADDRESS,
    accessTokenAddress: process.env.ACCESS_TOKEN_ADDRESS || '0xD92A7b96c01289e842a6d4f0197121979e9ae4b7',
    chainId: process.env.CHAIN_ID_LOCAL || '1337',  // Ganache默认chainId
    deploymentBlock: process.env.DEPLOYMENT_BLOCK ? parseInt(process.env.DEPLOYMENT_BLOCK) : 0
  },
  
  // 索引器配置
  indexer: {
    enabled: process.env.INDEXER_ENABLED === 'true' || false,
    syncInterval: parseInt(process.env.INDEXER_SYNC_INTERVAL || 1000) // 默认每5分钟同步一次
  },

  // 加密配置
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'VXNlIHRoaXMgc2VjcmV0IGtleSB0byBlbmNyeXB0IGFuZCBkZWNyeXB0IGZpbGVz', // 默认的 base64 编码密钥
    algorithm: 'aes-256-gcm'
  }
};

export default config; 