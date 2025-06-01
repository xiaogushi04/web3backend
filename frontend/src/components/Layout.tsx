import React, { useEffect, useState } from 'react';
import Navigation from './Navigation';
import Header from './Header';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { blockchainConfig } from '../config/blockchain';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);

  useEffect(() => {
    if (isConnected && chainId && chainId !== blockchainConfig.defaultChain.id) {
      setIsWrongNetwork(true);
    } else {
      setIsWrongNetwork(false);
    }
  }, [isConnected, chainId]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部 Banner */}
      <Header />

      {/* 网络警告 */}
      {isConnected && isWrongNetwork && (
        <div className="bg-yellow-600 text-white p-2 text-center">
          <p className="text-sm">
            您当前连接的网络不是本地 Ganache 测试网。
            <button 
              onClick={() => switchChain({ chainId: blockchainConfig.defaultChain.id })} 
              disabled={isSwitching}
              className="ml-2 underline hover:no-underline"
            >
              {isSwitching ? '切换中...' : '点击切换到本地网络'}
            </button>
          </p>
        </div>
      )}

      <div className="flex h-[calc(100vh-4rem)]">
        {/* 左侧导航栏 */}
        <div className="w-64 bg-white shadow-lg">
          <div className="h-full overflow-y-auto">
            <Navigation />
          </div>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 overflow-y-auto">
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout; 