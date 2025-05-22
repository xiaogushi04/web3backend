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
  royaltyPercentage?: number;
}

interface AccessToken {
  tokenId: string;
  resourceId: string;
  accessType: string;
  expiryTime: Date;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
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
      
      // 添加版税参数
      formData.append('royaltyPercentage', formData.get('royaltyPercentage') || '5');
      
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
  },
  
  // 获取购买费用明细
  getPurchaseBreakdown: async (tokenId: string) => {
    try {
      const response = await api.get<{success: boolean, data: any}>(
        `/api/contracts/purchase-breakdown/${tokenId}`
      );
      return response.data.data;
    } catch (error) {
      console.error(`获取购买费用明细失败: tokenId=${tokenId}, error=${error}`)
      // 返回默认值，避免界面崩溃
      return {
        totalPrice: "0",
        platformFee: "0",
        royaltyFee: "0",
        sellerReceives: "0",
        creator: ethers.constants.AddressZero,
        platformFeePercentage: 2,
        royaltyPercentage: 5
      };
    }
  },

  // 检查访问权限
  checkAccess: async (resourceId: string) => {
    try {
      if (!window.ethereum) {
        console.log('[NFTService] checkAccess: 未检测到MetaMask钱包');
        throw new Error('请安装 MetaMask 钱包');
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];

      console.log('[NFTService] checkAccess: 检查资源访问权限', {
        resourceId,
        address
      });

      const response = await api.get<{
        success: boolean,
        message?: string,
        data: {
          hasAccess: boolean;
          accessToken?: {
            tokenId: string;
            resourceId: string;
            accessType: string;
            expiryTime: Date;
            maxUses: number;
            usedCount: number;
            isActive: boolean;
          }
        }
      }>(`/api/contracts/access/check/${resourceId}?address=${address}`);

      console.log('[NFTService] checkAccess: 服务器响应', response.data);

      if (!response.data.success) {
        console.error('[NFTService] checkAccess: 服务器返回错误', response.data.message);
        throw new Error(response.data.message || '检查访问权限失败');
      }

      // 确保返回正确的数据格式，即使服务器返回的数据不完整
      const result = {
        hasAccess: response.data.data?.hasAccess || false,
        accessToken: response.data.data?.accessToken || null
      };
      
      console.log('[NFTService] checkAccess: 结果', result);
      return result;
    } catch (error) {
      console.error('[NFTService] checkAccess: 检查访问权限失败:', error);
      // 返回默认值，避免前端崩溃
      return {
        hasAccess: false,
        accessToken: null
      };
    }
  },

  // 购买访问权
  buyAccessToken: async (resourceId: string, duration: number, maxUses: number): Promise<{
    success: boolean;
    data: { accessTokenId: string };
    message?: string;
    errorDetails?: {
      code?: number;
      name?: string;
      response?: any;
      original?: string;
      type?: string;
    };
  }> => {
    try {
      if (!window.ethereum) {
        throw new Error('请安装 MetaMask 钱包');
      }

      console.log('[NFTService] buyAccessToken: 开始购买访问权流程');
      console.log(`[NFTService] buyAccessToken: 参数 - resourceId=${resourceId}, duration=${duration}, maxUses=${maxUses}`);

      // 获取当前连接的账户地址
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];
      console.log(`[NFTService] buyAccessToken: 用户钱包地址: ${userAddress}`);

      // 获取购买费用明细
      const accessConfig = await NFTService.getAccessConfig(resourceId);
      console.log('[NFTService] buyAccessToken: 访问权配置:', accessConfig);

      if (!accessConfig.price || accessConfig.price === "0" || !accessConfig.isActive) {
        throw new Error('该资源尚未设置访问权价格或未激活访问权功能');
      }

      // 检查用户余额
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const balance = await provider.getBalance(userAddress);
      const price = ethers.BigNumber.from(accessConfig.price);
      
      console.log(`[NFTService] buyAccessToken: 用户余额: ${ethers.utils.formatEther(balance)} ETH`);
      console.log(`[NFTService] buyAccessToken: 访问权价格: ${ethers.utils.formatEther(price)} ETH`);
      
      if (balance.lt(price)) {
        throw new Error(`余额不足，需要 ${ethers.utils.formatEther(price)} ETH，当前余额 ${ethers.utils.formatEther(balance)} ETH`);
      }

      // 创建合约实例
      const signer = provider.getSigner();
      const marketContract = new ethers.Contract(
        blockchainConfig.contracts.market.address,
        blockchainConfig.contracts.market.abi,
        signer
      );
      
      const accessTokenContract = new ethers.Contract(
        blockchainConfig.contracts.accessToken.address,
        blockchainConfig.contracts.accessToken.abi,
        signer
      );

      console.log(`[NFTService] buyAccessToken: Market合约地址: ${marketContract.address}`);
      console.log(`[NFTService] buyAccessToken: AccessToken合约地址: ${accessTokenContract.address}`);

      // 检查AccessToken合约的所有者
      const accessTokenOwner = await accessTokenContract.owner();
      console.log(`[NFTService] buyAccessToken: AccessToken合约所有者: ${accessTokenOwner}`);
      console.log(`[NFTService] buyAccessToken: 是否与Market合约地址匹配: ${accessTokenOwner.toLowerCase() === marketContract.address.toLowerCase()}`);

      // 估算gas
      try {
        const gasEstimate = await marketContract.estimateGas.buyAccessToken(
          resourceId,
          duration,
          maxUses,
          { value: price }
        );
        console.log(`[NFTService] buyAccessToken: 预估gas: ${gasEstimate.toString()}`);
      } catch (gasError: any) {
        console.error('[NFTService] buyAccessToken: Gas预估失败:', gasError);
        if (gasError.data) {
          console.error('[NFTService] buyAccessToken: Gas预估失败详情:', {
            error: gasError.error,
            errorData: gasError.data,
            errorArgs: gasError.args,
            errorCode: gasError.code,
            errorMessage: gasError.message
          });
        }
      }

      // 直接调用合约的buyAccessToken方法
      console.log(`[NFTService] buyAccessToken: 调用合约方法，参数:`, {
        resourceId,
        duration,
        maxUses,
        value: price.toString()
      });

      // 将天数转换为秒数
      const durationInSeconds = duration * 24 * 60 * 60;

      const tx = await marketContract.buyAccessToken(
        resourceId,
        durationInSeconds, // 使用转换后的秒数
        maxUses,
        { 
          value: price,
          gasLimit: 500000 // 使用固定的gas限制
        }
      );

      console.log('[NFTService] buyAccessToken: 交易已发送:', tx.hash);
      
      // 等待交易确认
      const receipt = await tx.wait();
      console.log('[NFTService] buyAccessToken: 交易已确认:', receipt);

      // 从事件中获取accessTokenId
      let accessTokenId = null;
      if (receipt.events) {
        const accessTokenSoldEvent = receipt.events.find((e: { event: string }) => e.event === 'AccessTokenSold');
        if (accessTokenSoldEvent && accessTokenSoldEvent.args) {
          accessTokenId = accessTokenSoldEvent.args.accessTokenId.toString();
          console.log(`[NFTService] buyAccessToken: AccessTokenId from event: ${accessTokenId}`);
        }
      }

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
        data: { accessTokenId: accessTokenId || '' },
        message: '访问权购买成功'
      };

    } catch (error: any) {
      console.error('[NFTService] buyAccessToken: 购买失败:', error);
      
      // 提供更详细的错误信息
      let errorMessage = '购买访问权失败';
      let errorDetails = {
        code: error.code,
        name: error.name,
        response: error.response?.data,
        original: error.message,
        type: error.type
      };
      
      if (error.code === 4001) {
        errorMessage = '用户拒绝了交易';
      } else if (error.code === -32603) {
        errorMessage = '合约执行失败，请检查：\n1. 资源是否存在\n2. 访问权是否已激活\n3. 支付金额是否正确';
        
        // 尝试从error对象中获取更多信息
        if (error.data) {
          console.error('[NFTService] buyAccessToken: 合约错误数据:', error.data);
          errorDetails.response = error.data;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        data: { accessTokenId: '' },
        message: errorMessage,
        errorDetails
      };
    }
  },

  // 获取用户的访问权列表
  getUserAccessTokens: async (userAddress: string): Promise<AccessToken[]> => {
    try {
      const response = await api.get(`/api/contracts/access-tokens/${userAddress}`);
      return response.data.data || [];
    } catch (error) {
      console.error('获取用户访问权列表失败:', error);
      return [];
    }
  },

  // 获取资源的访问权配置
  getAccessConfig: async (resourceId: string) => {
    try {
      console.log('[NFTService] getAccessConfig: 开始获取访问权配置');
      console.log(`[NFTService] getAccessConfig: 参数 - resourceId=${resourceId}`);
      
      const response = await api.get<{success: boolean, data: any}>(
        `/api/contracts/access/config/${resourceId}`
      );
      console.log(`[NFTService] getAccessConfig: 获取到配置:`, response.data);
      return response.data.data;
    } catch (error: any) {
      console.error('[NFTService] getAccessConfig: 获取访问权配置失败:', error);
      return { error: true, message: error.message || '获取访问权配置失败' };
    }
  },

  // 设置资源的访问权配置 (直接调用合约)
  setAccessConfigDirect: async (resourceId: string, maxTokens: number, price: string, isActive: boolean): Promise<{
    success: boolean;
    message?: string;
  }> => {
    try {
      console.log('[NFTService] setAccessConfigDirect: 开始设置访问权配置');
      console.log(`[NFTService] setAccessConfigDirect: 参数 - resourceId=${resourceId}, maxTokens=${maxTokens}, price=${price}, isActive=${isActive}`);
      
      if (!window.ethereum) {
        throw new Error('请安装 MetaMask 钱包');
      }

      // 获取当前连接的账户地址
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];
      console.log(`[NFTService] setAccessConfigDirect: 用户钱包地址: ${userAddress}`);

      // 创建 provider 和 signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // 创建 AccessToken 合约实例
      const accessTokenContract = new ethers.Contract(
        blockchainConfig.contracts.accessToken.address,
        blockchainConfig.contracts.accessToken.abi,
        signer
      );
      
      // 创建 AcademicNFT 合约实例
      const academicNFTContract = new ethers.Contract(
        blockchainConfig.contracts.academicNFT.address,
        blockchainConfig.contracts.academicNFT.abi,
        signer
      );
      
      // 检查资源所有权
      try {
        const resourceOwner = await academicNFTContract.ownerOf(resourceId);
        console.log(`[NFTService] setAccessConfigDirect: 资源所有者: ${resourceOwner}`);
        
        if (resourceOwner.toLowerCase() !== userAddress.toLowerCase()) {
          console.warn(`[NFTService] setAccessConfigDirect: 用户 ${userAddress} 不是资源 ${resourceId} 的所有者`);
          return { 
            success: false, 
            message: '您不是该资源的所有者，无法设置访问权配置。'
          };
        }
      } catch (ownerError) {
        console.error('[NFTService] setAccessConfigDirect: 检查资源所有权失败:', ownerError);
        return { 
          success: false, 
          message: '无法验证资源所有权，请确保资源ID正确。'
        };
      }

      // 将价格转换为 wei
      const priceInWei = ethers.utils.parseEther(price);
      console.log(`[NFTService] setAccessConfigDirect: 价格转换: ${price} ETH = ${priceInWei.toString()} wei`);

      // 调用合约方法
      console.log(`[NFTService] setAccessConfigDirect: 调用合约方法 setResourceAccessConfig...`);
      const tx = await accessTokenContract.setResourceAccessConfig(
        resourceId,
        maxTokens,
        priceInWei,
        isActive
      );
      
      console.log(`[NFTService] setAccessConfigDirect: 交易已发送, hash: ${tx.hash}`);
      
      // 等待交易确认
      const receipt = await tx.wait();
      console.log(`[NFTService] setAccessConfigDirect: 交易已确认, hash: ${receipt.transactionHash}, block: ${receipt.blockNumber}`);
      
      return {
        success: true,
        message: '访问权配置已成功更新'
      };
    } catch (error: any) {
      console.error('[NFTService] setAccessConfigDirect: 设置访问权配置失败:', error);
      let errorMessage = '设置访问权配置失败';
      
      if (error.code === 4001) {
        errorMessage = '用户拒绝了交易';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  },

  // 设置资源的访问权配置
  setAccessConfig: async (resourceId: string, maxTokens: number, price: string, isActive: boolean): Promise<{
    success: boolean;
    message?: string;
  }> => {
    try {
      console.log('[NFTService] setAccessConfig: 开始设置访问权配置');
      console.log(`[NFTService] setAccessConfig: 参数 - resourceId=${resourceId}, maxTokens=${maxTokens}, price=${price}, isActive=${isActive}`);
      
      if (!window.ethereum) {
        throw new Error('请安装 MetaMask 钱包');
      }

      // 获取当前连接的账户地址
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];
      console.log(`[NFTService] setAccessConfig: 用户钱包地址: ${userAddress}`);

      // 构建签名消息
      const message = `Set Access Config for resource ${resourceId}`;
      console.log(`[NFTService] setAccessConfig: 准备签名的消息: '${message}'`);

      // 创建 provider 和 signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // 请求签名
      console.log(`[NFTService] setAccessConfig: 请求用户 ${userAddress} 签名消息...`);
      const signature = await signer.signMessage(message);
      console.log(`[NFTService] setAccessConfig: 获取到签名: ${signature.slice(0, 10)}...${signature.slice(-8)}`);

      // 发送请求到后端
      console.log(`[NFTService] setAccessConfig: 正在发送请求到后端...`);
      const response = await api.post<{success: boolean, message?: string}>(
        '/api/contracts/access/config',
        { 
          resourceId, 
          maxTokens,
          price,
          isActive,
          address: userAddress,
          message,
        },
        {
          headers: {
            'x-signature': signature
          }
        }
      );

      console.log(`[NFTService] setAccessConfig: 收到后端响应:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error('[NFTService] setAccessConfig: 设置访问权配置失败:', error);
      let errorMessage = '设置访问权配置失败';
      
      if (error.code === 4001) {
        errorMessage = '用户拒绝了签名';
      } else if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  },

  // 获取资源内容
  getResourceContent: async (resourceId: string) => {
    try {
      // 获取用户地址和签名
      if (!window.ethereum) {
        throw new Error('请安装 MetaMask 钱包');
      }
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];

      // 创建签名消息
      const message = `获取资源内容 ${resourceId}`;
      
      // 获取签名
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, userAddress]
      });

      console.log('[NFTService] getResourceContent: 获取到签名', signature);

      const response = await api.get<{success: boolean, data: {content: string}}>(
        `/api/contracts/resource/${resourceId}/content`,
        {
          headers: {
            'x-signature': signature,
            'x-user-address': userAddress
          }
        }
      );

      return response.data.data.content;
    } catch (error) {
      console.error(`获取资源 ${resourceId} 内容失败:`, error);
      throw error;
    }
  },

  // 正在处理的访问权令牌ID集合（防止重复请求）
  _pendingAccessTokenRequests: new Set<string>(),

  // 使用访问权
  activateAccessToken: async (accessTokenId: string): Promise<{
    success: boolean;
    content?: string;
    message?: string;
    contractAddress?: string;
    methodName?: string;
    args?: any[];
  }> => {
    try {
      // 检查是否已经在处理该令牌的请求
      if (NFTService._pendingAccessTokenRequests.has(accessTokenId)) {
        console.log('[DEBUG][NFTService] activateAccessToken: 已有相同请求正在处理中，忽略本次调用', accessTokenId);
        return {
          success: false,
          message: '正在处理中，请勿重复操作'
        };
      }
      
      // 标记为正在处理
      NFTService._pendingAccessTokenRequests.add(accessTokenId);
      
      console.log('[DEBUG][NFTService] activateAccessToken: 开始使用访问权', accessTokenId);

      if (!window.ethereum) {
        throw new Error('请安装 MetaMask 钱包');
      }

      // 获取当前连接的账户地址
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];
      console.log('[DEBUG][NFTService] activateAccessToken: 用户地址', userAddress);

      // 创建签名消息
      const message = `使用访问权 ${accessTokenId}`;
      
      // 获取签名
      console.log('[DEBUG][NFTService] activateAccessToken: 请求签名消息', message);
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, userAddress]
      });
      console.log('[DEBUG][NFTService] activateAccessToken: 获取到签名', signature);

      // 发送到后端
      console.log('[DEBUG][NFTService] activateAccessToken: 发送请求到后端');
      const response = await api.post(
        `/api/contracts/access/use`,
        {
          accessTokenId,
          address: userAddress,
          message
        },
        {
          headers: {
            'x-signature': signature,
            'x-user-address': userAddress
          }
        }
      );

      console.log('[DEBUG][NFTService] activateAccessToken: 后端响应', response.data);

      if (!response.data.success) {
        console.error('[DEBUG][NFTService] activateAccessToken: 后端返回错误', response.data.message);
        return response.data;
      }

      const responseData = response.data.data;
      console.log('[DEBUG][NFTService] activateAccessToken: 合约地址', responseData.contractAddress);
      console.log('[DEBUG][NFTService] activateAccessToken: 方法名', responseData.methodName);
      console.log('[DEBUG][NFTService] activateAccessToken: 参数', responseData.args);
      console.log('[DEBUG][NFTService] activateAccessToken: 内容长度', responseData.content?.length || 0);

      // 如果没有合约调用信息，直接返回内容
      if (!responseData.methodName) {
        if (responseData.content) {
          return {
            success: true,
            content: responseData.content
          };
        }
        throw new Error('后端未返回合约调用信息');
      }

      // 创建合约实例
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // 使用 AccessToken 合约地址
      const contractAddress = blockchainConfig.contracts.accessToken.address;
      console.log('[DEBUG][NFTService] activateAccessToken: 使用合约地址', contractAddress);
      
      const contract = new ethers.Contract(
        contractAddress,
        blockchainConfig.contracts.accessToken.abi,
        signer
      );

      // 调用合约方法
      console.log('[DEBUG][NFTService] activateAccessToken: 调用合约方法', responseData.methodName);
      const tx = await contract[responseData.methodName](...(responseData.args || []));
      console.log('[DEBUG][NFTService] activateAccessToken: 交易已发送', tx.hash);
      
      // 等待交易确认
      const receipt = await tx.wait();
      console.log('[DEBUG][NFTService] activateAccessToken: 交易已确认', receipt);

      // 如果后端返回了内容，直接使用
      if (responseData.content) {
        console.log('[DEBUG][NFTService] activateAccessToken: 使用后端返回的内容');
        return {
          success: true,
          content: responseData.content
        };
      }

      // 如果没有内容，需要再次请求后端获取内容
      console.log('[DEBUG][NFTService] activateAccessToken: 重新请求资源内容');
      const contentResponse = await api.get(
        `/api/contracts/resource/${responseData.resourceId}/content`,
        {
          headers: {
            'x-signature': signature,
            'x-user-address': userAddress
          }
        }
      );

      if (!contentResponse.data.success || !contentResponse.data.data.content) {
        console.error('[DEBUG][NFTService] activateAccessToken: 获取资源内容失败');
        throw new Error('获取资源内容失败');
      }

      console.log('[DEBUG][NFTService] activateAccessToken: 成功获取资源内容');
      return {
        success: true,
        content: contentResponse.data.data.content
      };

    } catch (error: any) {
      console.error('[DEBUG][NFTService] activateAccessToken: 使用访问权失败:', error);
      
      // 包装错误响应
      if (error.response) {
        console.error('[DEBUG][NFTService] activateAccessToken: API错误响应:', error.response.data);
        return {
          success: false,
          message: error.response.data.message || '访问权激活失败'
        };
      }
      
      return {
        success: false,
        message: error.message || '使用访问权失败'
      };
    } finally {
      // 请求完成后，移除标记
      NFTService._pendingAccessTokenRequests.delete(accessTokenId);
    }
  },

  // 销毁访问权
  burnAccessToken: async (accessTokenId: string) => {
    try {
      const response = await api.post<{success: boolean}>(
        '/api/contracts/access/burn',
        { accessTokenId }
      );
      return response.data;
    } catch (error) {
      console.error('销毁访问权失败:', error);
      throw error;
    }
  },
};

export default NFTService; 