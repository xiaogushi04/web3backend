import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { NFTService } from '../services/nftApi';
import { ethers } from 'ethers';
import { blockchainConfig } from '../config/blockchain';

interface ResourceViewerProps {
  resourceId: string;
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

const ResourceViewer: React.FC<ResourceViewerProps> = ({ resourceId: propResourceId }) => {
  const params = useParams();
  const actualResourceId = propResourceId || params.id || '';
  const { address, isConnected } = useAccount();
  const [resource, setResource] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPurchased, setIsPurchased] = useState(false);
  const [purchaseBreakdown, setPurchaseBreakdown] = useState<any>(null);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessToken, setAccessToken] = useState<AccessToken | null>(null);
  const [isBuyingAccess, setIsBuyingAccess] = useState(false);
  const [accessDuration, setAccessDuration] = useState(30);
  const [maxUses, setMaxUses] = useState(10);
  
  // 添加访问权配置相关状态
  const [accessConfig, setAccessConfig] = useState<any>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [configMaxTokens, setConfigMaxTokens] = useState(100);
  const [configPrice, setConfigPrice] = useState("0.01");
  const [configActive, setConfigActive] = useState(true);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  useEffect(() => {
    if (actualResourceId) {
      fetchResourceDetails();
      checkAccess();
      fetchAccessConfig(); // 添加获取访问权配置
    } else {
      setError('资源ID无效');
      setIsLoading(false);
    }
  }, [actualResourceId, address]);
  
  // 当资源信息加载完成后，获取购买费用明细
  useEffect(() => {
    if (resource && resource.id && !isPurchased) {
      fetchPurchaseBreakdown();
    }
  }, [resource, isPurchased]);

  const fetchResourceDetails = async () => {
    try {
      setIsLoading(true);
      // 尝试从实际API获取数据
      try {
        const metadata = await NFTService.getResourceMetadata(actualResourceId);
        // 检查当前用户是否是所有者或已购买
        const isOwnerCheck = metadata.currentOwner && address && 
                     metadata.currentOwner.toLowerCase() === address.toLowerCase();
        const isCreator = metadata.creator && address &&
                     metadata.creator.toLowerCase() === address.toLowerCase();
        
        // 设置所有者状态
        setIsOwner(!!(isOwnerCheck || isCreator));
        
        // 检查是否已购买(所有者或创建者默认已拥有)
        if (isOwnerCheck || isCreator) {
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
          owner: metadata.currentOwner || metadata.creator || '未知',
          creator: metadata.creator || '未知',
          royaltyPercentage: metadata.royaltyPercentage || 0,
          listing: metadata.listing || { isActive: false }
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
        owner: '0x1234...5678',
        creator: '作者1, 作者2',
        royaltyPercentage: 10,
        listing: { isActive: true }
      };
      setResource(mockResource);
      setError(null);
    } catch (err) {
      setError('获取资源详情失败');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 获取购买费用明细
  const fetchPurchaseBreakdown = async () => {
    try {
      const breakdown = await NFTService.getPurchaseBreakdown(actualResourceId);
      setPurchaseBreakdown(breakdown);
    } catch (error) {
      console.error('获取购买费用明细失败:', error);
      // 不设置错误状态，因为这不是关键功能
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

  const checkAccess = async () => {
    try {
      const response = await NFTService.checkAccess(actualResourceId);
      setHasAccess(response.hasAccess);
      if (response.accessToken) {
        setAccessToken(response.accessToken);
      }
    } catch (error) {
      console.error('检查访问权限失败:', error);
    }
  };

  const handleBuyAccess = async () => {
    console.log('[ResourceViewer] handleBuyAccess: 开始购买资源', actualResourceId, '的访问权');
    console.log(`[ResourceViewer] handleBuyAccess: 参数 - accessDuration=${accessDuration}, maxUses=${maxUses}, 用户=${address}`);
    
    if (!address) {
      setError('请先连接钱包');
      return;
    }

    if (!actualResourceId) {
      setError('资源ID无效');
      return;
    }

    setIsBuyingAccess(true);
    setError(null);
    
    try {
      // 检查访问权配置是否存在
      const accessConfig = await NFTService.getAccessConfig(actualResourceId);
      console.log('[ResourceViewer] handleBuyAccess: 获取到访问权配置', accessConfig);
      
      if (accessConfig.error) {
        setError('无法获取访问权配置：' + accessConfig.message);
        return;
      }
      
      if (!accessConfig.price || accessConfig.price === "0" || !accessConfig.isActive) {
        setError('该资源尚未设置访问权价格或未激活访问权功能');
        return;
      }

      // 购买访问权
      const result = await NFTService.buyAccessToken(
        actualResourceId,
        accessDuration,
        maxUses
      );
      console.log('[ResourceViewer] handleBuyAccess: 购买访问权结果:', result);

      if (result.success) {
        setSuccess(`已成功购买访问权！访问权ID: ${result.data.accessTokenId}`);
        // 刷新访问状态
        checkAccess();
      } else {
        // 提取错误详情
        let errorMsg = result.message || '购买访问权失败';
        
        // 根据错误类型提供更具体的反馈
        if (result.errorDetails) {
          console.error('[ResourceViewer] handleBuyAccess: 错误详情:', result.errorDetails);
          
          if (result.message && result.message.includes('insufficient funds')) {
            errorMsg = '您的账户余额不足以支付访问权价格和Gas费用';
          } else if (result.message && result.message.includes('gas')) {
            errorMsg = '交易所需Gas费用过高，请尝试增加Gas限制或简化交易';
          } else if (result.message && result.message.includes('revert')) {
            errorMsg = '合约执行失败：可能是资金不足或其他条件不满足';
          }
        }
        
        setError(errorMsg);
      }
    } catch (error: any) {
      console.error('[ResourceViewer] handleBuyAccess: 购买访问权失败:', error);
      let errorMsg = '购买访问权失败';
      
      if (error.message) {
        if (error.message.includes('insufficient funds')) {
          errorMsg = '您的账户余额不足以支付访问权价格和Gas费用';
        } else if (error.message.includes('gas')) {
          errorMsg = '交易所需Gas费用过高，请尝试增加Gas限制或简化交易';
        } else if (error.message.includes('revert')) {
          errorMsg = '合约执行失败：可能是资金不足或其他条件不满足';
        } else {
          errorMsg = error.message;
        }
      }
      
      setError(errorMsg);
    } finally {
      setIsBuyingAccess(false);
    }
  };

  const fetchAccessConfig = async () => {
    if (!actualResourceId) return;
    
    try {
      setIsLoadingConfig(true);
      console.log(`[ResourceViewer] fetchAccessConfig: 获取资源 ${actualResourceId} 的访问权配置`);
      
      const config = await NFTService.getAccessConfig(actualResourceId);
      console.log(`[ResourceViewer] fetchAccessConfig: 获取到配置:`, config);
      
      setAccessConfig(config);
      
      // 如果有配置，更新表单值
      if (config && !config.error) {
        setConfigMaxTokens(Number(config.maxAccessTokens) || 100);
        setConfigPrice(ethers.utils.formatEther(config.price || "10000000000000000"));
        setConfigActive(!!config.isActive);
      }
    } catch (error) {
      console.error('[ResourceViewer] fetchAccessConfig: 获取访问权配置失败:', error);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  // 更新访问权配置
  const handleUpdateAccessConfig = async () => {
    if (!isConnected) {
      alert('请先连接钱包');
      return;
    }
    
    try {
      setIsUpdatingConfig(true);
      console.log(`[ResourceViewer] handleUpdateAccessConfig: 更新资源 ${actualResourceId} 的访问权配置`);
      console.log(`[ResourceViewer] handleUpdateAccessConfig: 参数 - maxTokens=${configMaxTokens}, price=${configPrice}, active=${configActive}`);
      
      // 使用直接调用合约的方式
      const result = await NFTService.setAccessConfigDirect(
        actualResourceId,
        configMaxTokens,
        configPrice,
        configActive
      );
      
      console.log(`[ResourceViewer] handleUpdateAccessConfig: 更新结果:`, result);
      
      if (result.success) {
        alert('访问权配置更新成功！');
        fetchAccessConfig(); // 重新获取配置
      } else {
        throw new Error(result.message || '更新失败');
      }
    } catch (error: any) {
      console.error('[ResourceViewer] handleUpdateAccessConfig: 更新访问权配置失败:', error);
      alert(`更新访问权配置失败: ${error.message || '未知错误'}`);
    } finally {
      setIsUpdatingConfig(false);
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

  if (success) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <h2 className="text-2xl font-bold text-green-600 mb-4">操作成功</h2>
        <p className="text-gray-600">{success}</p>
        <button 
          onClick={() => {
            setSuccess(null);
            fetchResourceDetails();
            checkAccess();
          }} 
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
          返回资源页面
        </button>
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

        {/* 访问权配置区域 - 仅对资源所有者显示 */}
        {isOwner && (
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h3 className="text-lg font-semibold mb-4">访问权配置管理</h3>
            
            {isLoadingConfig ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
              </div>
            ) :
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">最大访问权数量</label>
                    <input
                      type="number"
                      value={configMaxTokens}
                      onChange={(e) => setConfigMaxTokens(Number(e.target.value))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">访问权价格 (ETH)</label>
                    <input
                      type="text"
                      value={configPrice}
                      onChange={(e) => setConfigPrice(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={configActive}
                      onChange={(e) => setConfigActive(e.target.checked)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="ml-2">允许购买访问权</span>
                  </label>
                </div>
                <button
                  onClick={handleUpdateAccessConfig}
                  disabled={isUpdatingConfig}
                  className="w-full bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700"
                >
                  {isUpdatingConfig ? '更新中...' : '更新访问权配置'}
                </button>
                <p className="text-xs text-gray-500">
                  * 设置访问权配置后，其他用户可以购买临时访问权，而不必购买完整的NFT
                </p>
                {accessConfig && (
                  <div className="text-sm text-gray-600 mt-2">
                    <p>当前访问权状态: {accessConfig.isActive ? '已激活' : '未激活'}</p>
                    <p>价格: {accessConfig.price ? ethers.utils.formatEther(accessConfig.price) : '0'} ETH</p>
                    <p>已售出: {accessConfig.currentAccessTokens || 0} / {accessConfig.maxAccessTokens || 0}</p>
                  </div>
                )}
              </div>
            }
          </div>
        )}

        {/* 访问权状态 */}
        {!isPurchased && !hasAccess && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">购买访问权</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">访问时长（天）</label>
                <input
                  type="number"
                  value={accessDuration}
                  onChange={(e) => setAccessDuration(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">最大使用次数</label>
                <input
                  type="number"
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <button
                onClick={handleBuyAccess}
                disabled={isBuyingAccess}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                {isBuyingAccess ? '处理中...' : '购买访问权'}
              </button>
            </div>
          </div>
        )}

        {/* 访问权信息 */}
        {accessToken && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">访问权信息</h3>
            <div className="space-y-2">
              <p>类型：{accessToken.accessType}</p>
              <p>剩余使用次数：{accessToken.maxUses - accessToken.usedCount}</p>
              <p>过期时间：{new Date(accessToken.expiryTime).toLocaleDateString()}</p>
            </div>
          </div>
        )}

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
        
        {/* 价格和版税信息 */}
        {!isPurchased && (
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-gray-900">价格详情</h2>
              <button 
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showBreakdown ? '隐藏详情' : '查看详情'}
              </button>
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-medium">总价:</span>
              <span className="text-xl font-semibold">{ethers.utils.formatEther(resource.price)} ETH</span>
            </div>
            
            {showBreakdown && purchaseBreakdown && (
              <div className="bg-gray-50 p-4 rounded-md mt-2">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>平台服务费 ({purchaseBreakdown.platformFeePercentage}%):</span>
                    <span>{ethers.utils.formatEther(purchaseBreakdown.platformFee)} ETH</span>
                  </div>
                  
                  {purchaseBreakdown.royaltyPercentage > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>创作者版税 ({purchaseBreakdown.royaltyPercentage}%):</span>
                      <span>{ethers.utils.formatEther(purchaseBreakdown.royaltyFee)} ETH</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                    <span>卖家收入:</span>
                    <span>{ethers.utils.formatEther(purchaseBreakdown.sellerReceives)} ETH</span>
                  </div>
                </div>
                
                {purchaseBreakdown.creator && 
                 purchaseBreakdown.creator !== ethers.constants.AddressZero && 
                 purchaseBreakdown.royaltyPercentage > 0 && (
                  <div className="mt-3 text-sm text-green-600">
                    <p>
                      * 购买此资源将支付{purchaseBreakdown.royaltyPercentage}%的版税给原创作者，
                      支持学术创作持续发展。
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
              onClick={() => setShowPurchaseDialog(true)}
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
              ) : `购买资源 (${ethers.utils.formatEther(resource.price)} ETH)`}
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

      {/* 在资源详情部分添加版税信息显示 */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">资源详情</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">标题</h3>
            <p className="mt-1 text-gray-600">{resource.title}</p>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">描述</h3>
            <p className="mt-1 text-gray-600">{resource.abstract}</p>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">创作者</h3>
            <p className="mt-1 text-gray-600">{resource.creator}</p>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">版税比例</h3>
            <p className="mt-1 text-gray-600">{resource.royaltyPercentage}%</p>
            <p className="mt-1 text-sm text-gray-500">每次交易时创作者将获得此比例的收益</p>
          </div>
          {resource.listing?.isActive && (
            <div>
              <h3 className="text-lg font-medium text-gray-900">当前价格</h3>
              <p className="mt-1 text-gray-600">{ethers.utils.formatEther(resource.price)} ETH</p>
            </div>
          )}
        </div>
      </div>

      {/* 在购买确认对话框中添加版税信息 */}
      {showPurchaseDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">确认购买</h3>
            <div className="space-y-4">
              <p className="text-gray-600">您确定要购买这个资源吗？</p>
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm text-gray-600">总价：{ethers.utils.formatEther(resource.price)} ETH</p>
                <p className="text-sm text-gray-600">平台服务费：{ethers.utils.formatEther(purchaseBreakdown.platformFee)} ETH (2%)</p>
                <p className="text-sm text-gray-600">创作者版税：{ethers.utils.formatEther(purchaseBreakdown.royaltyFee)} ETH ({resource.royaltyPercentage}%)</p>
                <p className="text-sm text-gray-600">卖家收入：{ethers.utils.formatEther(purchaseBreakdown.sellerReceives)} ETH</p>
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowPurchaseDialog(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  取消
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={isPurchasing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPurchasing ? '购买中...' : '确认购买'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceViewer; 