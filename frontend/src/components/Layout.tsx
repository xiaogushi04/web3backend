import React, { useEffect, useState } from 'react';
import Navigation from './Navigation';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);

  useEffect(() => {
    if (isConnected && chainId && chainId !== sepolia.id) {
      setIsWrongNetwork(true);
    } else {
      setIsWrongNetwork(false);
    }
  }, [isConnected, chainId]);

  return (
    <div className="min-h-screen bg-black text-white">
      {isConnected && isWrongNetwork && (
        <div className="bg-yellow-600 text-white p-2 text-center">
          <p className="text-sm">
            您当前连接的网络不是 Sepolia 测试网。
            <button 
              onClick={() => switchChain({ chainId: sepolia.id })} 
              disabled={isSwitching}
              className="ml-2 underline hover:no-underline"
            >
              {isSwitching ? '切换中...' : '点击切换'}
            </button>
          </p>
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <div className="flex">
          {/* 左侧导航栏 */}
          <div className="w-[275px] fixed h-screen border-r border-gray-800">
            <Navigation />
          </div>

          {/* 主内容区域 */}
          <div className="ml-[275px] flex-1">
            <main className="max-w-2xl mx-auto">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout; 