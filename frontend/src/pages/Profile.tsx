import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Link } from 'react-router-dom';
import NFTService from '../services/nftApi';
import type { ChangeEvent } from 'react';
import { ethers } from 'ethers';
import { useToast } from '../components/ToastManager';

// 声明 JSX 命名空间
declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
      span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
      button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
      input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
    }
  }
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

const Profile: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { showToast } = useToast();
  const [userResources, setUserResources] = useState<any[]>([]);
  const [accessTokens, setAccessTokens] = useState<AccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listingTokenId, setListingTokenId] = useState<string | null>(null);
  const [listingPrice, setListingPrice] = useState<string>('0.1');
  const [isListing, setIsListing] = useState(false);
  const [activeTab, setActiveTab] = useState<'resources' | 'access'>('resources');
  const [userStats, setUserStats] = useState({
    uploads: 0,
    transfers: 0,
    references: 0,
    earnings: '0.00',
    sellerEarnings: '0.00',
    creatorEarnings: '0.00'
  });

  const fetchUserResources = useCallback(async () => {
    try {
      setLoading(true);
      
      // 获取用户资源
      const data = await NFTService.getUserResources(address as string);
      setUserResources(data.resources || []);
      
      // 获取用户交易历史和收益
      const transactionData = await NFTService.getUserTransactionHistory(address as string);
      console.log('交易数据:', transactionData);
      
      // 计算用户统计数据
      calculateUserStats(data.resources || [], transactionData);
      
      setError(null);
    } catch (err: any) {
      console.error('获取用户资源失败:', err);
      setError('获取用户资源失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }, [address]);

  const fetchAccessTokens = useCallback(async () => {
    try {
      setLoading(true);
      const tokens = await NFTService.getUserAccessTokens(address as string);
      setAccessTokens(tokens);
      setError(null);
    } catch (err: any) {
      console.error('获取访问权列表失败:', err);
      setError('获取访问权列表失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      if (activeTab === 'resources') {
      fetchUserResources();
      } else {
        fetchAccessTokens();
      }
    } else {
      setLoading(false);
    }
  }, [address, activeTab, fetchUserResources, fetchAccessTokens]);

  const calculateUserStats = (resources: any[], transactionData: any) => {
    // 默认值
    const stats = {
      uploads: resources.length,
      transfers: 0,
      references: 0,
      earnings: '0.00',
      sellerEarnings: '0.00',
      creatorEarnings: '0.00'
    };
    
    // 从交易数据中获取交易次数和收益
    if (transactionData) {
      stats.transfers = transactionData.totalTransfers || 0;
      stats.earnings = transactionData.totalEarnings || '0.00';
      stats.sellerEarnings = transactionData.sellerEarnings || '0.00';
      stats.creatorEarnings = transactionData.creatorEarnings || '0.00';
    }
    
    // 计算引用次数
    resources.forEach(nft => {
      if (nft.references) {
        stats.references += nft.references.length;
      }
    });
    
    console.log('用户统计数据:', stats);
    setUserStats(stats);
  };

  const handleListNFT = async (tokenId: string) => {
    if (!tokenId || !listingPrice || parseFloat(listingPrice) <= 0) {
      showToast('请输入有效的价格', 'warning');
      return;
    }

    try {
      setIsListing(true);
      try {
        if (!window.ethereum) {
          throw new Error('未检测到以太坊钱包');
        }

        const ethereum = window.ethereum;
        if (!ethereum.request) {
          throw new Error('钱包不支持请求方法');
        }

        // 使用与后端完全相同的消息格式
        const message = `授权访问资源 ${tokenId}`;
        
        // 使用 personal_sign 方法签名消息
        const signature = await ethereum.request({
          method: 'personal_sign',
          params: [message, address]
        });

        console.log('签名消息:', message);
        console.log('签名地址:', address);
        console.log('签名结果:', signature);

        // 使用签名进行后续操作
        const result = await NFTService.listResource(tokenId, listingPrice, signature);
        
        if (result && result.success) {
          showToast('NFT上架成功！', 'success');
          // 重置状态
          setListingTokenId(null);
          setListingPrice('0.1');
          // 刷新资源列表
          fetchUserResources();
        } else {
          throw new Error(result?.message || '上架失败，请稍后再试');
        }
      } catch (error: any) {
        console.error('上架失败:', error);
        showToast(`上架失败: ${error.message || '未知错误'}`, 'error');
      }
    } catch (error: any) {
      console.error('上架失败:', error);
      showToast(`上架失败: ${error.message || '未知错误'}`, 'error');
    } finally {
      setIsListing(false);
    }
  };

  const handleCancelListing = async (tokenId: string) => {
    // TODO: 实现下架功能，如果后端提供了相应接口
    showToast('下架功能暂未实现', 'info');
  };

  const handleUseAccessToken = async (tokenId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // 获取访问权对应的资源ID
      const token = accessTokens.find(t => t.tokenId === tokenId);
      if (!token) {
        setError('无法找到对应的资源信息');
        return;
      }

      // 检查访问权是否有效
      if (!token.isActive || token.usedCount >= token.maxUses) {
        setError('访问权已失效或使用次数已达上限');
        return;
      }

      console.log(`[Profile] 使用访问权 ${tokenId} 访问资源 ${token.resourceId}`);
      // 直接跳转到资源内容页面，确保URL参数格式正确
      window.location.href = `/resource/${token.resourceId}/content?access_token=${tokenId}`;
    } catch (error: any) {
      console.error('使用访问权失败:', error);
      setError(error.message || '使用访问权失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handleBurnAccessToken = async (tokenId: string) => {
    try {
      const response = await NFTService.burnAccessToken(tokenId);
      if (response.success) {
        await fetchAccessTokens(); // 刷新列表
      } else {
        throw new Error('销毁访问权失败');
      }
    } catch (error) {
      console.error('销毁访问权失败:', error);
      showToast('销毁访问权失败，请稍后再试', 'error');
    }
  };

  if (!address) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">请先连接钱包</h2>
        <p className="text-gray-600">您需要连接钱包才能访问个人中心</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* 标签页导航 */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('resources')}
              className={`py-4 px-6 text-sm font-medium ${
                activeTab === 'resources'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              我的资源
            </button>
            <button 
              onClick={() => setActiveTab('access')}
              className={`py-4 px-6 text-sm font-medium ${
                activeTab === 'access'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              访问权管理
            </button>
          </nav>
          </div>

        {/* 内容区域 */}
        <div className="p-6">
          {activeTab === 'resources' ? (
            // 资源列表
            userResources.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-500">您还没有拥有任何资源</p>
            <Link
              to="/upload"
              className="mt-4 inline-block px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
            >
              上传您的第一个资源
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {userResources.map((resource) => (
              <div
                key={resource.tokenId}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {resource.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      上传时间：{new Date(resource.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Link
                    to={`/resource/${resource.tokenId}`}
                    className="text-sm text-gray-900 hover:text-gray-700"
                  >
                    查看详情 →
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm text-gray-500">
                  <div>交易次数：{resource.transfers ? resource.transfers.length - 1 : 0}</div>
                  <div>引用次数：{resource.references ? resource.references.length : 0}</div>
                  <div>
                    {resource.listing && resource.listing.isActive ? (
                      <span className="text-green-500">上架价格: {ethers.utils.formatEther(resource.listing.price)} ETH</span>
                    ) : (
                      <span>未上架</span>
                    )}
                  </div>
                </div>
                
                {/* 上架/下架操作 */}
                <div className="mt-4 border-t pt-4">
                  {resource.listing && resource.listing.isActive ? (
                    <button
                      onClick={() => handleCancelListing(resource.tokenId)}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-all"
                    >
                      下架
                    </button>
                  ) : listingTokenId === resource.tokenId ? (
                    <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                      <div className="flex-1">
                        <input
                          type="number"
                          value={listingPrice}
                          onChange={(e) => setListingPrice(e.target.value)}
                          placeholder="输入价格 (ETH)"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-gray-900"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleListNFT(resource.tokenId)}
                          disabled={isListing}
                          className="px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 transition-all disabled:bg-green-300"
                        >
                          {isListing ? '上架中...' : '确认上架'}
                        </button>
                        <button
                          onClick={() => setListingTokenId(null)}
                          className="px-3 py-1.5 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition-all"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setListingTokenId(resource.tokenId)}
                      className="px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-all"
                    >
                      上架出售
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
            )
          ) : (
            // 访问权列表
            accessTokens.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500">您还没有任何访问权</p>
              </div>
            ) : (
              <div className="space-y-4">
                {accessTokens.map((token) => (
                  <div
                    key={token.tokenId}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          资源ID: {token.resourceId}
                        </h3>
                        <p className="text-sm text-gray-500">
                          类型: {token.accessType}
                        </p>
                        <p className="text-sm text-gray-500">
                          剩余使用次数: {token.maxUses - token.usedCount}
                        </p>
                        <p className="text-sm text-gray-500">
                          过期时间: {new Date(token.expiryTime).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="space-x-2">
                        {token.isActive && token.usedCount < token.maxUses && (
                          <button
                            onClick={() => handleUseAccessToken(token.tokenId)}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            使用
                          </button>
                        )}
                        {token.isActive && (
                          <button
                            onClick={() => handleBurnAccessToken(token.tokenId)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            销毁
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile; 