import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
    try {
        // 创建 provider
        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
        
        // 测试连接
        const blockNumber = await provider.getBlockNumber();
        console.log('当前区块高度:', blockNumber);
        
        // 测试钱包连接
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const balance = await provider.getBalance(wallet.address);
        console.log('钱包地址:', wallet.address);
        console.log('钱包余额:', ethers.formatEther(balance), 'ETH');
        
        return true;
    } catch (error) {
        console.error('连接测试失败:', error);
        return false;
    }
}

// 运行测试
testConnection().then(success => {
    if (success) {
        console.log('区块链连接测试成功！');
    } else {
        console.log('区块链连接测试失败！');
    }
}); 