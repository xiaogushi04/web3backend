import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 添加调试日志
console.log('合约配置检查:');
console.log('环境变量 MARKET_CONTRACT_ADDRESS:', process.env.MARKET_CONTRACT_ADDRESS);
console.log('环境变量 ACADEMIC_NFT_CONTRACT_ADDRESS:', process.env.ACADEMIC_NFT_CONTRACT_ADDRESS);
console.log('环境变量 ACCESS_TOKEN_ADDRESS:', process.env.ACCESS_TOKEN_ADDRESS);

// 读取 ABI 文件
const readABI = (abiPath) => {
  try {
    const fullPath = path.join(__dirname, '../../', abiPath);
    console.log('尝试读取 ABI 文件:', fullPath);
    const abiContent = fs.readFileSync(fullPath, 'utf8');
    const parsed = JSON.parse(abiContent);
    return parsed.abi; // 返回 ABI 数组
  } catch (error) {
    console.error(`读取 ABI 文件失败: ${abiPath}`, error);
    return null;
  }
};

const contracts = {
  academicNFT: {
    address: process.env.ACADEMIC_NFT_CONTRACT_ADDRESS,
    abi: readABI('artifacts/src/contracts/AcademicNFT.sol/AcademicNFT.json'),
    name: 'AcademicNFT'
  },
  reference: {
    address: process.env.REFERENCE_CONTRACT_ADDRESS,
    abi: readABI('artifacts/src/contracts/Reference.sol/Reference.json'),
    name: 'Reference'
  },
  market: {
    address: process.env.MARKET_CONTRACT_ADDRESS,
    abi: readABI('artifacts/src/contracts/Market.sol/AcademicMarket.json'),
    name: 'AcademicMarket'
  },
  accessToken: {
    address: process.env.ACCESS_TOKEN_ADDRESS || '0xD92A7b96c01289e842a6d4f0197121979e9ae4b7', // 使用与前端相同的地址作为默认值
    abi: readABI('artifacts/src/contracts/AccessToken.sol/AccessToken.json'),
    name: 'AccessToken'
  }
};

// 验证合约配置
Object.entries(contracts).forEach(([name, contract]) => {
  if (!contract.address) {
    console.error(`警告: ${name} 合约地址未配置`);
  }
  if (!contract.abi) {
    console.error(`警告: ${name} 合约 ABI 未找到`);
  }
});

export default contracts; 