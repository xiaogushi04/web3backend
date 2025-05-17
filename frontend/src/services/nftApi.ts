import api from './api';
import { AxiosRequestConfig } from 'axios';
import { ethers } from 'ethers';
import { blockchainConfig } from '../config/blockchain';

interface NFTMetadata {
  tokenId: string;
  title: string;
  description: string;
  ipfsHash: string;
  resourceType: string;
  authors: string[];
  creator: string;
  currentOwner: string;
  createdAt: string;
  lastTransferredAt: string;
  transfers: {
    from: string;
    to: string;
    timestamp: string;
    blockNumber?: number;
    transactionHash?: string;
  }[];
  references: {
    referenceId: string;
    sourceTokenId: string;
    targetTokenId: string;
    description: string;
    timestamp: string;
  }[];
  listing?: {
    isActive: boolean;
    price: string;
    seller: string | null;
    listedAt: string | null;
  };
}

interface NFTListResponse {
  total: number;
  resources: NFTMetadata[];
  note?: string;
}

export const NFTService = {
  // 获取资源列表
  getResources: async (limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc') => {
    try {
      const response = await api.get<{success: boolean, data: NFTListResponse}>(
        `/api/contracts/resources?limit=${limit}&offset=${offset}&sortBy=${sortBy}&sortOrder=${sortOrder}`
      );
      return response.data.data;
    } catch (error) {
      console.error('获取资源列表失败:', error);
      throw error;
    }
  },

  // 获取用户资源列表
  getUserResources: async (userAddress: string, limit = 50, offset = 0) => {
    try {
      // 确保地址格式一致性 (小写)
      const normalizedAddress = userAddress.toLowerCase();
      const response = await api.get<{success: boolean, data: NFTListResponse}>(
        `/api/contracts/user/${normalizedAddress}/resources?limit=${limit}&offset=${offset}`
      );
      return response.data.data;
    } catch (error) {
      console.error(`获取用户 ${userAddress} 的资源列表失败:`, error);
      throw error;
    }
  },

  // 获取市场上架的资源列表
  getMarketResources: async (limit = 50, offset = 0) => {
    try {
      const response = await api.get<{success: boolean, data: NFTListResponse}>(
        `/api/contracts/market?limit=${limit}&offset=${offset}`
      );
      return response.data.data;
    } catch (error) {
      console.error('获取市场资源列表失败:', error);
      throw error;
    }
  },

  // 获取单个资源元数据
  getResourceMetadata: async (tokenId: string) => {
    try {
      const response = await api.get<{success: boolean, data: NFTMetadata}>(
        `/api/contracts/resource/${tokenId}`
      );
      return response.data.data;
    } catch (error) {
      console.error(`获取资源 ${tokenId} 元数据失败:`, error);
      throw error;
    }
  },

  // 获取资源转移历史
  getResourceTransfers: async (tokenId: string) => {
    try {
      const response = await api.get<{success: boolean, data: any[]}>(
        `/api/contracts/resource/${tokenId}/transfers`
      );
      return response.data.data;
    } catch (error) {
      console.error(`获取资源 ${tokenId} 转移历史失败:`, error);
      throw error;
    }
  },

  // 获取资源引用
  getResourceReferences: async (tokenId: string) => {
    try {
      const response = await api.get<{success: boolean, data: any[]}>(
        `/api/contracts/resource/${tokenId}/references`
      );
      return response.data.data;
    } catch (error) {
      console.error(`获取资源 ${tokenId} 引用失败:`, error);
      throw error;
    }
  },

  // 铸造资源
  mintResource: async (formData: FormData) => {
    try {
      const config: AxiosRequestConfig = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };
      
      const response = await api.post<{success: boolean, data: any}>(
        '/api/contracts/mint-with-file',
        formData,
        config
      );
      return response.data.data;
    } catch (error) {
      console.error('铸造资源失败:', error);
      throw error;
    }
  },

  // 创建引用
  createReference: async (sourceTokenId: string, targetTokenId: string, description: string) => {
    try {
      const response = await api.post<{success: boolean, data: any}>(
        '/api/contracts/reference',
        {
          sourceTokenId,
          targetTokenId,
          description
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('创建引用失败:', error);
      throw error;
    }
  },

  // 上架NFT
  listToken: async (tokenId: string, price: string, privateKey: string) => {
    try {
      console.log(`上架NFT ${tokenId} 价格: ${price} ETH`);
      const response = await api.post('/api/contracts/list', {
        tokenId,
        price,
        privateKey
      });
      return response.data;
    } catch (error) {
      console.error(`上架NFT ${tokenId} 失败:`, error);
      throw error;
    }
  },

  // 使用签名上架NFT
  listResource: async (tokenId: string, price: string, signature: string): Promise<{
    success: boolean;
    data: {
      tokenId: string;
      price: string;
      transactionHash: string;
    } | null;
    message: string;
  }> => {
    try {
      console.log('=== 开始上架 NFT 流程 ===');
      console.log(`参数信息:
        - tokenId: ${tokenId}
        - price: ${price} ETH
        - signature: ${signature.slice(0, 10)}...${signature.slice(-8)}
      `);
      
      if (!window.ethereum) {
        throw new Error('请安装 MetaMask 钱包');
      }

      // 获取合约地址
      const marketAddress = blockchainConfig.contracts.market.address;
      const nftAddress = blockchainConfig.contracts.academicNFT.address;

      console.log('合约地址信息:');
      console.log('- Market合约:', marketAddress);
      console.log('- NFT合约:', nftAddress);

      if (!marketAddress || !nftAddress) {
        throw new Error('合约地址未配置');
      }

      // 创建合约实例
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // 创建NFT合约实例
      const nftContract = new ethers.Contract(
        nftAddress,
        blockchainConfig.contracts.academicNFT.abi,
        signer
      );

      // 检查是否已授权
      const isApproved = await nftContract.isApprovedForAll(
        await signer.getAddress(),
        marketAddress
      );

      // 如果未授权，先进行授权
      if (!isApproved) {
        console.log('Market合约未授权，开始授权...');
        const approveTx = await nftContract.setApprovalForAll(marketAddress, true);
        console.log('授权交易已发送:', approveTx.hash);
        await approveTx.wait();
        console.log('授权交易已确认');
      }

      // 调用后端API获取交易数据
      const response = await api.post('/api/contracts/list', {
        tokenId,
        price,
        signature
      });

      if (!response.data.success) {
        throw new Error(response.data.message || '上架失败');
      }

      // 获取交易数据
      const txData = response.data.data;
      console.log('获取到交易数据:', txData);

      // 确保价格正确转换为wei
      const priceInWei = ethers.utils.parseEther(price);
      console.log('价格转换:', `${price} ETH = ${priceInWei.toString()} wei`);

      // 创建Market合约实例
      const marketContract = new ethers.Contract(
        marketAddress,
        blockchainConfig.contracts.market.abi,
        signer
      );

      // 直接调用Market合约的listToken方法
      const tx = await marketContract.listToken(tokenId, priceInWei);
      console.log('交易已发送:', tx.hash);
      
      // 等待交易确认
      const receipt = await tx.wait();
      console.log('交易已确认:', receipt);

      // 调用后端同步接口
      try {
        console.log('开始同步索引器...');
        await api.post('/api/indexer/sync', {
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber
        });
        console.log('索引器同步完成');
      } catch (syncError) {
        console.error('索引器同步失败:', syncError);
        // 不抛出错误，因为上架已经成功
      }

      return {
        success: true,
        data: {
          tokenId,
          price,
          transactionHash: tx.hash
        },
        message: '上架成功'
      };
    } catch (error: any) {
      console.error('上架 NFT 失败:', error);
      
      // 提供更详细的错误信息
      let errorMessage = '上架失败';
      if (error.code === -32603) {
        errorMessage = '合约执行失败，请确保：\n1. 您拥有该NFT\n2. 已授权Market合约操作NFT\n3. 价格设置合理';
      } else if (error.code === 4001) {
        errorMessage = '用户拒绝了交易';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        data: null,
        message: errorMessage
      };
    }
  },

  // 购买NFT
  buyToken: async (tokenId: string, price: string) => {
    try {
      if (!window.ethereum) {
        throw new Error('请安装 MetaMask 钱包');
      }

      const ethereum = window.ethereum;
      if (!ethereum.request) {
        throw new Error('钱包不支持请求方法');
      }

      // 获取当前连接的账户地址
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const buyerAddress = accounts[0];

      // 创建合约实例
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // 创建Market合约实例
      const marketContract = new ethers.Contract(
        blockchainConfig.contracts.market.address,
        blockchainConfig.contracts.market.abi,
        signer
      );

      // 直接调用合约的buyToken方法
      const tx = await marketContract.buyToken(tokenId, { value: price });
      console.log('交易已发送:', tx.hash);
      
      // 等待交易确认
      const receipt = await tx.wait();
      console.log('交易已确认:', receipt);

      // 调用后端同步接口
      try {
        console.log('开始同步索引器...');
        await api.post('/api/indexer/sync', {
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber
        });
        console.log('索引器同步完成');
      } catch (syncError) {
        console.error('索引器同步失败:', syncError);
        // 不抛出错误，因为购买已经成功
      }

      return {
        success: true,
        data: {
          tokenId,
          price,
          transactionHash: tx.hash
        },
        message: '购买成功'
      };
    } catch (error: any) {
      console.error(`购买NFT ${tokenId} 失败:`, error);
      
      // 提供更详细的错误信息
      let errorMessage = '购买失败';
      if (error.code === -32603) {
        errorMessage = '合约执行失败，请确保：\n1. 您有足够的ETH\n2. NFT仍在售\n3. 价格正确';
      } else if (error.code === 4001) {
        errorMessage = '用户拒绝了交易';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        data: null,
        message: errorMessage
      };
    }
  },

  // 获取上架信息
  getListing: async (tokenId: string) => {
    try {
      const response = await api.get<{success: boolean, data: any}>(
        `/api/contracts/listing/${tokenId}`
      );
      return response.data.data;
    } catch (error) {
      console.error(`获取NFT ${tokenId} 上架信息失败:`, error);
      throw error;
    }
  },

  // 获取用户交易历史
  getUserTransactionHistory: async (address: string) => {
    try {
      const response = await api.get<{success: boolean, data: any}>(
        `/api/contracts/user/${address}/transactions`
      );
      return response.data.data;
    } catch (error) {
      console.error(`获取用户 ${address} 交易历史失败:`, error);
      throw error;
    }
  }
};

export default NFTService; 