import databaseService from './services/database.js';
import cacheService from './services/cache.js';
import ipfsService from './services/ipfs.js';
import blockchainService from './services/blockchain.js';

async function testServices() {
  try {
    console.log('开始测试所有服务...\n');

    // 测试 MongoDB 连接
    console.log('1. 测试 MongoDB 连接...');
    await databaseService.connect();
    console.log('MongoDB 连接测试成功\n');

    // 测试 Redis 连接
    console.log('2. 测试 Redis 连接...');
    await cacheService.connect();
    
    // 测试 Redis 基本操作
    const testKey = 'test:key';
    const testValue = { message: 'Hello Redis!' };
    await cacheService.set(testKey, testValue);
    const cachedValue = await cacheService.get(testKey);
    console.log('Redis 存储测试:', cachedValue);
    await cacheService.delete(testKey);
    console.log('Redis 连接和基本操作测试成功\n');

    // 测试 IPFS 连接
    console.log('3. 测试 IPFS 连接...');
    const testContent = Buffer.from('测试 IPFS 连接');
    const { cid } = await ipfsService.uploadFile(testContent);
    console.log('IPFS 上传测试成功，CID:', cid);
    const content = await ipfsService.getFile(cid);
    console.log('IPFS 获取测试成功，内容:', content.toString());
    console.log('IPFS 连接测试成功\n');

    // 测试区块链服务
    console.log('4. 测试区块链服务...');
    const testAddress = '0x0000000000000000000000000000000000000000';
    const testMessage = 'Hello Web3!';
    const testSignature = '0x...'; // 这里需要真实的签名
    const isValid = await blockchainService.verifySignature(testAddress, testMessage, testSignature);
    console.log('区块链服务初始化成功\n');

    console.log('所有服务测试完成！');

  } catch (error) {
    console.error('测试过程中发生错误:', error);
  } finally {
    // 清理连接
    await databaseService.disconnect();
    await cacheService.disconnect();
  }
}

// 运行测试
testServices(); 