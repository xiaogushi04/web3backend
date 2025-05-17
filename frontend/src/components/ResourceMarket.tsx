import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { NFTService } from '../services/nftApi';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';

interface Resource {
  id: string;
  title: string;
  abstract: string;
  author: string;
  price: string;
  keywords: string[];
}

const ResourceMarket: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [resources, setResources] = useState<Resource[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      // 尝试从实际API获取数据
      try {
        const response = await NFTService.getMarketResources();
        if (response && response.resources && response.resources.length > 0) {
          // 转换API响应格式为组件所需格式
          const formattedResources = response.resources.map(item => ({
            id: item.tokenId,
            title: item.title || '未命名资源',
            abstract: item.description || '无描述',
            author: item.currentOwner || item.creator || '未知作者',
            price: item.listing?.price || '0',
            keywords: item.description ? item.description.split(', ') : []
          }));
          setResources(formattedResources);
          return;
        }
      } catch (error) {
        console.error('无法从API获取资源:', error);
        // 失败时回退到模拟数据
      }
      
      // 模拟数据（当API调用失败时）
      setResources([
        {
          id: '1',
          title: '区块链技术在学术资源共享中的应用研究',
          abstract: '本文探讨了区块链技术在学术资源共享领域的应用...',
          author: '0x1234...5678',
          price: '0.1',
          keywords: ['区块链', '学术资源', '去中心化']
        },
        {
          id: '2',
          title: '基于智能合约的学术成果确权机制',
          abstract: '研究了一种基于智能合约的学术成果确权机制...',
          author: '0x8765...4321',
          price: '0.2',
          keywords: ['智能合约', '确权', '学术成果']
        }
      ]);
    } catch (error) {
      console.error('获取资源失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (resourceId: string, price: string) => {
    if (!isConnected || !address) {
      alert('请先连接钱包');
      return;
    }

    try {
      setPurchaseLoading(resourceId);
      // 调用购买API
      const result = await NFTService.buyToken(resourceId, price);
      
      if (result && result.success) {
        alert('购买成功！');
        // 重定向到资源详情页
        navigate(`/resource/${resourceId}`);
      } else {
        throw new Error(result?.message || '购买失败，请稍后再试');
      }
    } catch (error: any) {
      console.error('购买失败:', error);
      alert(`购买失败: ${error.message || '未知错误'}`);
    } finally {
      setPurchaseLoading(null);
    }
  };

  const filteredResources = resources.filter(resource =>
    resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    resource.abstract.toLowerCase().includes(searchTerm.toLowerCase()) ||
    resource.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="my-6">
        <input
          type="text"
          placeholder="搜索论文标题、摘要或关键词..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
        />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredResources.length > 0 ? (
            filteredResources.map((resource) => (
              <div key={resource.id} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900">{resource.title}</h3>
                <p className="mt-2 text-sm text-gray-600 line-clamp-3">{resource.abstract}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {resource.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">作者: {resource.author}</span>
                  <span className="text-sm font-medium text-gray-900">{ethers.utils.formatEther(resource.price)} ETH</span>
                </div>
                <button
                  onClick={() => handlePurchase(resource.id, resource.price)}
                  disabled={!isConnected || purchaseLoading === resource.id}
                  className="mt-4 w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 transition-all"
                >
                  {!isConnected ? '请先连接钱包' : 
                   purchaseLoading === resource.id ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      购买中...
                    </span>
                  ) : '购买访问权'}
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-12 text-gray-500">
              未找到匹配的资源
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResourceMarket; 