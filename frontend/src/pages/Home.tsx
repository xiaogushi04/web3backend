import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import NFTService from '../services/nftApi';
import { ethers } from 'ethers';
import { useToast } from '../components/ToastManager';

const Home: React.FC = () => {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  useEffect(() => {
    // 加载市场上架的资源列表
    fetchMarketResources();
  }, []);

  const fetchMarketResources = async () => {
    try {
      setLoading(true);
      // 使用getMarketResources而不是getResources来获取市场上的NFT
      const data = await NFTService.getMarketResources(30, 0);
      setResources(data.resources || []);
      setError(null);
    } catch (err: any) {
      console.error('获取市场资源列表失败:', err);
      setError('获取市场资源列表失败，请稍后再试');
      showToast('获取市场资源列表失败，请稍后再试', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('搜索:', searchQuery);
    // TODO: 实现搜索功能
  };

  const handlePurchase = async (tokenId: string, price: string) => {
    if (!isConnected) {
      showToast('请先连接钱包', 'warning');
      return;
    }

    try {
      setPurchasingId(tokenId);
      // 调用购买API
      const result = await NFTService.buyToken(tokenId, price);
      
      if (result && result.success) {
        showToast('购买成功！', 'success');
        // 刷新市场列表
        fetchMarketResources();
      } else {
        throw new Error(result?.message || '购买失败，请稍后再试');
      }
    } catch (error: any) {
      console.error('购买失败:', error);
      showToast(`购买失败: ${error.message || '未知错误'}`, 'error');
    } finally {
      setPurchasingId(null);
    }
  };

  // 热门标签
  const popularTags = ['区块链', '人工智能', '机器学习', '量子计算'];

  // 过滤搜索结果
  const filteredResources = resources.filter(resource => 
    resource.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    resource.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* 搜索栏 */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-6 border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 text-center">探索学术资源</h1>
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索论文、数据集、代码..."
              className="w-full px-4 py-3 bg-white text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm shadow-sm"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-gray-50 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* 热门标签 */}
      <div className="max-w-7xl mx-auto px-6 py-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-2 justify-center">
          {popularTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSearchQuery(tag)}
              className="px-4 py-2 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm border border-gray-200 shadow-sm hover:shadow-md"
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* 页面标题 */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">市场上的学术资源</h2>
            <p className="text-sm text-gray-500 mt-1">浏览并购买上架的学术资源</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>最新上架</span>
          </div>
        </div>

        {/* 资源列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-500">加载中...</p>
            </div>
          ) : error ? (
            <div className="col-span-full p-12 text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <button 
                className="px-4 py-2 bg-white text-gray-600 rounded-lg hover:bg-gray-50 border border-gray-200 shadow-sm"
                onClick={fetchMarketResources}
              >
                重试
              </button>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="col-span-full p-12 text-center">
              <p className="text-gray-500">
                {searchQuery ? `未找到与"${searchQuery}"相关的资源` : '市场上暂无上架资源'}
              </p>
            </div>
          ) : (
            filteredResources.map((resource) => (
              <article
                key={resource.tokenId}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                        <Link to={`/resource/${resource.tokenId}`} className="hover:text-blue-600">
                          {resource.title}
                        </Link>
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-2">{resource.description}</p>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <span>创建者</span>
                        <span className="px-2 py-1 bg-gray-50 rounded-md">
                          {resource.creator?.slice(0, 6)}...{resource.creator?.slice(-4)}
                        </span>
                      </div>
                      <span className="px-2 py-1 bg-gray-50 rounded-md">
                        {['论文', '数据集', '代码', '其他'][parseInt(resource.resourceType)] || '未知'}
                      </span>
                    </div>

                    {resource.listing && resource.listing.isActive && (
                      <div className="flex items-center justify-between">
                        <div className="text-green-600 font-medium flex items-center space-x-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{ethers.utils.formatEther(resource.listing.price)} ETH</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/resource/${resource.tokenId}`}
                            className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-sm border border-gray-200"
                          >
                            查看详情
                          </Link>
                          {resource.listing && resource.listing.isActive && (
                            <button
                              onClick={() => handlePurchase(resource.tokenId, resource.listing.price)}
                              disabled={purchasingId === resource.tokenId || !isConnected}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:bg-blue-400 disabled:cursor-not-allowed shadow-sm"
                            >
                              {purchasingId === resource.tokenId ? (
                                <span className="flex items-center space-x-1">
                                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>购买中</span>
                                </span>
                              ) : '购买'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-4 text-gray-400 pt-4 border-t border-gray-100">
                      <div className="flex items-center space-x-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span className="text-sm">{resource.transfers ? resource.transfers.length - 1 : 0}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        <span className="text-sm">{resource.references ? resource.references.length : 0}</span>
                      </div>
                      <span className="text-sm">{new Date(resource.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Home; 