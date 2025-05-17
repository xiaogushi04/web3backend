import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { ethers } from 'ethers';
import config from './config/config.js';
import ipfsService from './services/ipfs.js';

async function testNFTFlow() {
  try {
    console.log('开始测试 NFT 铸造流程...\n');

    // 检查环境配置
    console.log('检查环境配置...');
    if (!config.blockchain.rpcUrl) {
      throw new Error('RPC URL 未配置');
    }
    if (!config.blockchain.privateKey) {
      throw new Error('私钥未配置');
    }
    if (!config.blockchain.academicNFTAddress) {
      throw new Error('AcademicNFT 合约地址未配置');
    }
    console.log('环境配置检查通过\n');

    // 1. 准备测试文件
    console.log('1. 准备测试文件...');
    const testFilePath = path.join(process.cwd(), 'test-files', 'test-paper.pdf');
    if (!fs.existsSync(testFilePath)) {
      // 创建测试文件目录
      const testFilesDir = path.join(process.cwd(), 'test-files');
      if (!fs.existsSync(testFilesDir)) {
        fs.mkdirSync(testFilesDir);
      }
      // 创建一个简单的测试 PDF 文件
      const testContent = Buffer.from('这是一个测试 PDF 文件的内容');
      fs.writeFileSync(testFilePath, testContent);
    }
    console.log('测试文件准备完成\n');

    // 2. 准备测试钱包
    console.log('2. 准备测试钱包...');
    const provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    const wallet = new ethers.Wallet(config.blockchain.privateKey, provider);
    console.log('测试钱包地址:', wallet.address);
    
    // 检查钱包余额
    const balance = await provider.getBalance(wallet.address);
    console.log('钱包余额:', ethers.formatEther(balance), 'ETH\n');
    if (balance === 0n) {
      throw new Error('钱包余额不足，请确保有足够的测试网 ETH');
    }

    // 3. 开始上传文件并铸造 NFT
    console.log('3. 开始上传文件并铸造 NFT...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));
    formData.append('to', wallet.address);
    formData.append('title', '测试论文');
    formData.append('description', '这是一个测试论文');
    formData.append('resourceType', '0'); // 0 = Paper, 1 = Dataset, 2 = Code, 3 = Other
    formData.append('authors', JSON.stringify([wallet.address]));

    try {
      const response = await axios.post('http://localhost:3000/api/contracts/mint-with-file', formData, {
        headers: {
          ...formData.getHeaders()
        }
      });

      console.log('NFT 铸造成功！');
      console.log('Token ID:', response.data.data.tokenId);
      console.log('IPFS Hash:', response.data.data.ipfsHash, '\n');

      // 4. 验证 NFT 元数据
      console.log('4. 验证 NFT 元数据...');
      try {
        const metadataResponse = await axios.get(`http://localhost:3000/api/contracts/resource/${response.data.data.tokenId}`);
        console.log('元数据:', metadataResponse.data.data, '\n');
      } catch (metadataError) {
        console.error('获取元数据失败:', metadataError.message);
        if (metadataError.response) {
          console.error('状态码:', metadataError.response.status);
          console.error('响应数据:', metadataError.response.data);
        }
      }

      // 5. 验证 IPFS 文件
      console.log('5. 验证 IPFS 文件...');
      try {
        console.log(`正在使用IPFS服务获取文件 (CID: ${response.data.data.ipfsHash})...`);
        const fileContent = await ipfsService.getFile(response.data.data.ipfsHash);
        
        if (fileContent) {
          console.log('IPFS 文件获取成功！');
          console.log(`文件大小: ${fileContent.length} 字节`);
          
          // 如果文件较小，可以尝试显示内容
          if (fileContent.length < 1000) {
            try {
              console.log('文件内容:', fileContent.toString('utf8').substring(0, 200));
            } catch (e) {
              console.log('文件内容无法显示为文本');
            }
          }
          console.log();
        } else {
          console.log('IPFS文件获取失败\n');
        }
      } catch (error) {
        console.error('IPFS文件验证过程中发生错误:', error.message);
      }

      // 6. 测试资源列表API
      console.log('6. 测试资源列表API...');
      try {
        console.log('请求资源列表: GET /api/contracts/resources');
        const resourcesResponse = await axios.get('http://localhost:3000/api/contracts/resources?limit=5', {
          timeout: 10000  // 设置超时时间为10秒
        });
        
        console.log('资源列表API响应状态:', resourcesResponse.status);
        
        if (resourcesResponse.data && resourcesResponse.data.success) {
          console.log(`获取到 ${resourcesResponse.data.data.resources.length} 个资源（共 ${resourcesResponse.data.data.total} 个）`);
          if (resourcesResponse.data.data.resources.length > 0) {
            console.log('最新资源:', {
              tokenId: resourcesResponse.data.data.resources[0].tokenId,
              title: resourcesResponse.data.data.resources[0].title,
              ipfsHash: resourcesResponse.data.data.resources[0].ipfsHash
            });
          }
        } else {
          console.warn('资源列表API返回非成功状态:', resourcesResponse.data);
        }
      } catch (listError) {
        console.error('获取资源列表失败:', listError.message);
        
        // 尝试获取更详细的错误信息
        if (listError.response) {
          console.error('错误状态码:', listError.response.status);
          console.error('错误响应数据:', listError.response.data);
          
          // 如果是500错误，可能是后端服务问题
          if (listError.response.status === 500) {
            console.log('\n尝试单独获取当前铸造的NFT元数据...');
            try {
              const singleNFT = await axios.get(`http://localhost:3000/api/contracts/resource/${response.data.data.tokenId}`);
              console.log('单个NFT元数据获取成功:', singleNFT.data.data);
            } catch (e) {
              console.error('单个NFT元数据也无法获取:', e.message);
            }
          }
        }
      }

      // 如果资源列表API失败，尝试获取用户的NFT列表
      console.log('\n7. 测试用户NFT列表API...');
      try {
        // 确保钱包地址是小写形式
        const formattedAddress = wallet.address.toLowerCase();
        console.log(`规范化的钱包地址: ${formattedAddress}`);
        console.log(`原始钱包地址: ${wallet.address}`);
        
        console.log(`请求用户NFT列表(使用规范化地址): GET /api/contracts/user/${formattedAddress}/resources`);
        const userNFTResponse = await axios.get(`http://localhost:3000/api/contracts/user/${formattedAddress}/resources`, {
          timeout: 10000
        });
        
        if (userNFTResponse.data && userNFTResponse.data.success) {
          console.log(`用户拥有 ${userNFTResponse.data.data.total} 个NFT`);
          if (userNFTResponse.data.data.resources.length > 0) {
            console.log('用户最新NFT:', {
              tokenId: userNFTResponse.data.data.resources[0].tokenId,
              title: userNFTResponse.data.data.resources[0].title
            });
          } else {
            console.log('用户没有NFT，尝试使用原始地址格式...');
            
            // 如果使用规范化地址没有找到NFT，尝试使用原始地址
            const originalAddressResponse = await axios.get(`http://localhost:3000/api/contracts/user/${wallet.address}/resources`, {
              timeout: 10000
            });
            
            if (originalAddressResponse.data && originalAddressResponse.data.success) {
              console.log(`使用原始地址格式，用户拥有 ${originalAddressResponse.data.data.total} 个NFT`);
              if (originalAddressResponse.data.data.resources.length > 0) {
                console.log('用户最新NFT (使用原始地址):', {
                  tokenId: originalAddressResponse.data.data.resources[0].tokenId,
                  title: originalAddressResponse.data.data.resources[0].title
                });
              }
            }
          }
        } else {
          console.warn('用户NFT列表API返回非成功状态:', userNFTResponse.data);
        }
      } catch (userNFTError) {
        console.error('获取用户NFT列表失败:', userNFTError.message);
        if (userNFTError.response) {
          console.error('错误状态码:', userNFTError.response.status);
          console.error('错误响应数据:', userNFTError.response.data);
        }
      }

      console.log('\n测试完成！NFT铸造流程基本成功，部分功能可能需要进一步调试。');
    } catch (error) {
      if (error.response) {
        console.error('API 错误:', error.response.data);
      } else if (error.request) {
        console.error('网络错误:', error.message);
      } else {
        console.error('错误:', error.message);
      }
      throw error;
    }
  } catch (error) {
    console.error('测试过程中发生错误:', error);
    process.exit(1);
  }
}

testNFTFlow(); 