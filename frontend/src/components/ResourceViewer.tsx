import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { NFTService } from '../services/nftApi';

interface ResourceViewerProps {
  resourceId: string;
}

const ResourceViewer: React.FC<ResourceViewerProps> = ({ resourceId: propResourceId }) => {
  const params = useParams();
  const actualResourceId = propResourceId || params.id || '';
  const { address, isConnected } = useAccount();
  const [resource, setResource] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPurchased, setIsPurchased] = useState(false);

  useEffect(() => {
    if (actualResourceId) {
      fetchResourceDetails();
    } else {
      setError('资源ID无效');
      setIsLoading(false);
    }
  }, [actualResourceId, address]);

  const fetchResourceDetails = async () => {
    try {
      setIsLoading(true);
      // 尝试从实际API获取数据
      try {
        const metadata = await NFTService.getResourceMetadata(actualResourceId);
        // 检查当前用户是否是所有者或已购买
        const isOwner = metadata.currentOwner && address && 
                       metadata.currentOwner.toLowerCase() === address.toLowerCase();
        const isCreator = metadata.creator && address &&
                       metadata.creator.toLowerCase() === address.toLowerCase();
        
        // 检查是否已购买(所有者或创建者默认已拥有)
        if (isOwner || isCreator) {
          setIsPurchased(true);
        } else {
          // 这里可以添加检查用户是否已购买的接口调用
          // 例如: const hasPurchased = await NFTService.checkPurchase(actualResourceId, address);
          // 暂时使用临时逻辑
          setIsPurchased(false);
        }
        
        setResource({
          id: actualResourceId,
          title: metadata.title || '未命名资源',
          authors: metadata.authors?.join(', ') || '未知作者',
          abstract: metadata.description || '无摘要',
          keywords: metadata.description ? metadata.description.split(', ') : [],
          field: metadata.resourceType || '未分类',
          version: '1.0', // 默认版本
          doi: 'N/A', // 默认DOI
          license: 'CC-BY-4.0', // 默认许可证
          uploadDate: metadata.createdAt ? new Date(metadata.createdAt).toLocaleDateString() : '未知',
          price: metadata.listing?.price || '0',
          downloads: 0, // 目前API没有这些数据，设置默认值
          citations: metadata.references?.length || 0,
          owner: metadata.currentOwner || metadata.creator || '未知'
        });
        setError(null);
        return;
      } catch (apiError) {
        console.error('API请求失败，使用模拟数据:', apiError);
      }

      // 当API请求失败时使用模拟数据
      const mockResource = {
        id: actualResourceId,
        title: '示例论文标题',
        authors: '作者1, 作者2',
        abstract: '这是一段示例摘要，描述论文的主要内容和贡献...',
        keywords: ['关键词1', '关键词2', '关键词3'],
        field: '计算机科学',
        version: '1.0.0',
        doi: '10.1234/example.2024',
        license: 'CC-BY-4.0',
        uploadDate: '2024-03-15',
        price: '0.1',
        downloads: 123,
        citations: 45,
        owner: '0x1234...5678'
      };
      setResource(mockResource);
      setError(null);
    } catch (err) {
      setError('获取资源详情失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!isConnected) {
      alert('请先连接钱包');
      return;
    }

    if (!isPurchased) {
      alert('请先购买资源');
      return;
    }

    try {
      setIsDownloading(true);
      // 调用下载接口
      try {
        // 假设有一个下载API
        const response = await fetch(`/api/contracts/resource/${actualResourceId}/download`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error('下载失败');
        }
        
        // 获取文件blob
        const blob = await response.blob();
        // 创建下载链接
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${resource.title}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('下载失败:', error);
        alert('下载失败，请稍后再试');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePurchase = async () => {
    if (!isConnected) {
      alert('请先连接钱包');
      return;
    }

    if (!resource || !resource.id || !resource.price) {
      alert('资源信息不完整，无法购买');
      return;
    }

    try {
      setIsPurchasing(true);
      // 调用购买API
      const result = await NFTService.buyToken(resource.id, resource.price);
      
      if (result && result.success) {
        setIsPurchased(true);
        alert('购买成功！');
        // 刷新资源详情
        fetchResourceDetails();
      } else {
        throw new Error(result?.message || '购买失败，请稍后再试');
      }
    } catch (error: any) {
      console.error('购买失败:', error);
      alert(`购买失败: ${error.message || '未知错误'}`);
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">出错了</h2>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">资源不存在</h2>
        <p className="text-gray-600">未找到请求的资源</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="space-y-6">
        {/* 标题和作者 */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{resource.title}</h1>
          <p className="text-gray-600">作者：{resource.authors}</p>
        </div>

        {/* 元数据 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-500">研究领域：{resource.field}</p>
            <p className="text-sm text-gray-500">版本：{resource.version}</p>
            <p className="text-sm text-gray-500">DOI：{resource.doi}</p>
            <p className="text-sm text-gray-500">许可证：{resource.license}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">上传时间：{resource.uploadDate}</p>
            <p className="text-sm text-gray-500">下载次数：{resource.downloads}</p>
            <p className="text-sm text-gray-500">引用次数：{resource.citations}</p>
            <p className="text-sm text-gray-500">所有者：{resource.owner}</p>
          </div>
        </div>

        {/* 摘要 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">摘要</h2>
          <p className="text-gray-600">{resource.abstract}</p>
        </div>

        {/* 关键词 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">关键词</h2>
          <div className="flex flex-wrap gap-2">
            {resource.keywords.map((keyword: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-all hover:scale-105"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-4">
          {!isConnected ? (
            <button
              disabled
              className="px-6 py-2 bg-gray-400 text-white rounded-md cursor-not-allowed"
            >
              请先连接钱包
            </button>
          ) : !isPurchased ? (
            <button
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-all hover:scale-105 disabled:opacity-70 disabled:hover:scale-100 disabled:hover:bg-gray-900"
            >
              {isPurchasing ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  购买中...
                </span>
              ) : `购买资源 (${resource.price} ETH)`}
            </button>
          ) : (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-all hover:scale-105 disabled:opacity-70 disabled:hover:scale-100 disabled:hover:bg-gray-900"
            >
              {isDownloading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  下载中...
                </span>
              ) : '下载资源'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResourceViewer; 