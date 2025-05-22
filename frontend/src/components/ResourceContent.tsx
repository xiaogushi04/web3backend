import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { NFTService } from '../services/nftApi';
import { ethers } from 'ethers';
import { blockchainConfig } from '../config/blockchain';

interface ResourceContentProps {
  resourceId?: string;
}

const ResourceContent: React.FC<ResourceContentProps> = ({ resourceId: propResourceId }) => {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const actualResourceId = propResourceId || params.id || '';
  const { address, isConnected } = useAccount();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resourceContent, setResourceContent] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessToken, setAccessToken] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 检查访问权限
  const checkAccess = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log(`[ResourceContent] 开始检查资源 ${actualResourceId} 的访问权限`);
      
      const response = await NFTService.checkAccess(actualResourceId);
      console.log(`[ResourceContent] 检查结果:`, response);
      
      setHasAccess(response.hasAccess);
      if (response.hasAccess) {
        if (response.accessToken) {
          console.log(`[ResourceContent] 找到有效的访问权:`, response.accessToken);
          setAccessToken(response.accessToken);
        }
        // 如果有访问权限，获取资源内容
        console.log(`[ResourceContent] 用户有访问权限，获取资源内容`);
        await fetchResourceContent();
      } else {
        console.log(`[ResourceContent] 用户没有访问权限`);
      }
    } catch (error) {
      console.error('[ResourceContent] 检查访问权限失败:', error);
      setError('检查访问权限失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  }, [actualResourceId]);

  // 获取资源内容
  const fetchResourceContent = async () => {
    try {
      console.log('[ResourceContent] fetchResourceContent: 开始获取资源内容', actualResourceId);
      const content = await NFTService.getResourceContent(actualResourceId);
      setResourceContent(content);
      setError(null);
    } catch (error: any) {
      console.error('获取资源内容失败:', error);
      setError(error.message || '获取资源内容失败，请稍后再试');
    }
  };

  // 使用访问权
  const handleUseAccessToken = useCallback(async (tokenId: string) => {
    if (isProcessing) {
      console.log('[ResourceContent] 已有请求正在处理中，忽略本次调用');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      
      console.log(`[ResourceContent] 开始使用访问权 ${tokenId} 访问资源 ${actualResourceId}`);
      
      // 先获取访问权对应的资源ID
      const accessTokensResponse = await NFTService.getUserAccessTokens(address || '');
      console.log(`[ResourceContent] 用户访问权列表:`, accessTokensResponse);
      
      const tokenInfo = accessTokensResponse.find(t => t.tokenId === tokenId);
      console.log(`[ResourceContent] 找到的访问权信息:`, tokenInfo);
      
      if (!tokenInfo) {
        throw new Error(`找不到ID为 ${tokenId} 的访问权`);
      }
      
      if (tokenInfo.resourceId !== actualResourceId) {
        throw new Error(`访问权 ${tokenId} 不属于资源 ${actualResourceId}，而是属于资源 ${tokenInfo.resourceId}`);
      }
      
      // 检查访问权是否有效
      if (!tokenInfo.isActive) {
        throw new Error('访问权已失效');
      }
      
      if (tokenInfo.usedCount >= tokenInfo.maxUses) {
        throw new Error('访问权使用次数已达上限');
      }
      
      // 设置访问权信息
      setAccessToken(tokenInfo);
      
      // 调用后端获取合约调用数据和资源内容
      console.log(`[ResourceContent] 开始调用activateAccessToken，参数:`, { tokenId, address });
      const response = await NFTService.activateAccessToken(tokenId);
      console.log(`[ResourceContent] activateAccessToken返回数据:`, response);
      
      if (!response.success) {
        if (response.message === '正在处理中，请勿重复操作') {
          console.log('[ResourceContent] 请求正在处理中，等待结果...');
          return;
        }
        throw new Error(response.message || '获取访问权信息失败');
      }
      
      if (!response.content) {
        throw new Error('后端未返回资源内容');
      }
      
      // 更新访问状态和内容
      console.log(`[ResourceContent] 设置访问状态为true，内容长度:`, response.content.length);
      setHasAccess(true);
      setResourceContent(response.content);
      setIsLoading(false);
    } catch (error: any) {
      console.error('[ResourceContent] 使用访问权失败:', error);
      setError(error.message || '使用访问权失败，请稍后再试');
      setHasAccess(false);
      setResourceContent(null);
      setIsLoading(false);
    } finally {
      setIsProcessing(false);
    }
  }, [actualResourceId, address]);

  useEffect(() => {
    if (actualResourceId) {
      // 从 URL 获取 access_token 参数
      const accessTokenFromUrl = searchParams.get('access_token');
      console.log(`[ResourceContent] 从URL获取的访问权令牌: ${accessTokenFromUrl || '无'}`);
      
      if (accessTokenFromUrl) {
        // 如果 URL 中有 access_token，使用它来获取资源内容
        console.log(`[ResourceContent] 使用URL中的访问权令牌: ${accessTokenFromUrl}`);
        handleUseAccessToken(accessTokenFromUrl);
      } else {
        // 否则只检查访问权限
        console.log(`[ResourceContent] 检查资源 ${actualResourceId} 的访问权限`);
        checkAccess();
      }
    } else {
      setError('资源ID无效');
      setIsLoading(false);
    }
  }, [actualResourceId, address, searchParams, checkAccess, handleUseAccessToken]);

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
        <button 
          onClick={() => window.history.back()} 
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
          返回上一页
        </button>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">无访问权限</h2>
        <p className="text-gray-600">您没有访问此资源的权限，请先购买资源或购买访问权。</p>
        <button 
          onClick={() => window.location.href = `/resource/${actualResourceId}`} 
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          前往资源详情页
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">资源内容</h2>
      
      {accessToken && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-2">访问权信息</h3>
          <div className="space-y-2">
            <p>类型：{accessToken.accessType}</p>
            <p>剩余使用次数：{accessToken.maxUses - accessToken.usedCount}</p>
            <p>过期时间：{new Date(accessToken.expiryTime).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
        </div>
      )}
      
      <div className="bg-gray-50 p-6 rounded-lg">
        {resourceContent ? (
          <div className="prose max-w-none">
            {resourceContent}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">资源内容不可用</p>
          </div>
        )}
      </div>
      
      <div className="mt-6 flex justify-between">
        <button 
          onClick={() => window.location.href = `/resource/${actualResourceId}`} 
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
          返回资源详情
        </button>
        
        <button 
          onClick={() => window.print()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          打印内容
        </button>
      </div>
    </div>
  );
};

export default ResourceContent;