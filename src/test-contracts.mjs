import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testContracts() {
    try {
        // 创建 provider 和 wallet
        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        console.log('开始测试智能合约...');
        
        // 读取合约 ABI
        const academicNFTABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/contracts/artifacts/src/contracts/AcademicNFT.sol/AcademicNFT.json'), 'utf8')).abi;
        const referenceABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/contracts/artifacts/src/contracts/Reference.sol/ReferenceRecord.json'), 'utf8')).abi;
        
        // 获取已部署的合约地址
        const academicNFTAddress = process.env.ACADEMIC_NFT_ADDRESS;
        const referenceAddress = process.env.REFERENCE_ADDRESS;
        
        if (!academicNFTAddress || !referenceAddress) {
            throw new Error('合约地址未在环境变量中配置');
        }
        
        // 创建合约实例
        const academicNFT = new ethers.Contract(academicNFTAddress, academicNFTABI, wallet);
        const reference = new ethers.Contract(referenceAddress, referenceABI, wallet);
        
        console.log('合约实例创建成功');
        
        // 测试 AcademicNFT 合约
        console.log('\n测试 AcademicNFT 合约:');
        const name = await academicNFT.name();
        const symbol = await academicNFT.symbol();
        console.log(`合约名称: ${name}`);
        console.log(`合约符号: ${symbol}`);
        
        // 测试 Reference 合约
        console.log('\n测试 Reference 合约:');
        const referenceCount = await reference.getReferenceCount();
        console.log(`当前引用数量: ${referenceCount}`);
        
        return true;
    } catch (error) {
        console.error('合约测试失败:', error);
        return false;
    }
}

// 运行测试
testContracts().then(success => {
    if (success) {
        console.log('\n智能合约测试成功！');
    } else {
        console.log('\n智能合约测试失败！');
    }
}); 