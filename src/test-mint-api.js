import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { ethers } from 'ethers';
import config from './config/config.js';

async function testMintAPI() {
  try {
    console.log('开始测试 mint-with-file API...\n');

    // 检查配置文件
    console.log('检查配置文件...');
    if (!config.blockchain) {
      throw new Error('配置文件缺少 blockchain 配置');
    }
    console.log('RPC URL:', config.blockchain.rpcUrl);
    console.log('合约地址:', config.blockchain.academicNFTAddress, '\n');

    // 1. 准备测试文件
    console.log('1. 准备测试文件...');
    const testFilePath = path.join(process.cwd(), 'test-files', 'test-paper.pdf');
    console.log('测试文件路径:', testFilePath);
    
    if (!fs.existsSync(testFilePath)) {
      console.log('测试文件不存在，正在创建...');
      // 创建测试文件目录
      const testFilesDir = path.join(process.cwd(), 'test-files');
      if (!fs.existsSync(testFilesDir)) {
        fs.mkdirSync(testFilesDir);
      }
      // 创建一个简单的测试 PDF 文件
      const testContent = Buffer.from('这是一个测试 PDF 文件的内容');
      fs.writeFileSync(testFilePath, testContent);
      console.log('测试文件创建成功');
    }
    console.log('测试文件准备完成\n');

    // 2. 准备测试钱包
    console.log('2. 准备测试钱包...');
    if (!config.blockchain.privateKey) {
      throw new Error('配置文件缺少私钥');
    }
    
    const provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    const wallet = new ethers.Wallet(config.blockchain.privateKey, provider);
    console.log('测试钱包地址:', wallet.address);
    
    // 检查钱包余额
    const balance = await provider.getBalance(wallet.address);
    console.log('钱包余额:', ethers.formatEther(balance), 'ETH\n');
    if (balance === 0n) {
      throw new Error('钱包余额不足，请确保有足够的测试网 ETH');
    }

    // 3. 准备请求数据
    console.log('3. 准备请求数据...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));
    formData.append('to', wallet.address);
    formData.append('title', '测试论文');
    formData.append('description', '这是一个测试论文');
    formData.append('resourceType', '0'); // 0 = Paper, 1 = Dataset, 2 = Code, 3 = Other
    formData.append('authors', JSON.stringify([wallet.address]));

    // 打印完整的请求数据
    console.log('完整的请求数据:');
    console.log('- 文件路径:', testFilePath);
    console.log('- 接收地址:', wallet.address);
    console.log('- 标题:', '测试论文');
    console.log('- 描述:', '这是一个测试论文');
    console.log('- 资源类型:', '0 (Paper)');
    console.log('- 作者:', JSON.stringify([wallet.address]));
    console.log('- FormData 头信息:', formData.getHeaders());

    // 4. 发送请求
    console.log('\n4. 发送请求...');
    
    // 尝试不同的URL
    const urls = [
      'http://localhost:3000/api/contracts/mint-with-file',
      'http://localhost:3000/contracts/mint-with-file'
    ];
    
    console.log('尝试多个URL路径...');
    
    let response = null;
    let error = null;
    
    for (const url of urls) {
      try {
        console.log(`尝试URL: ${url}`);
        response = await axios.post(url, formData, {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/json'
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });
        
        console.log('API 响应成功:', response.data);
        break; // 如果成功就停止尝试
      } catch (err) {
        console.error(`URL ${url} 请求失败:`, err.message);
        if (err.response) {
          console.error('状态码:', err.response.status);
          console.error('响应数据:', err.response.data);
        }
        error = err;
      }
    }
    
    if (!response && error) {
      throw error; // 如果所有URL都失败了，抛出最后一个错误
    }
    
    console.log('API 响应:', response.data);
  } catch (error) {
    console.error('\n测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 添加未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('未处理的 Promise 拒绝:', error);
  process.exit(1);
});

testMintAPI(); 