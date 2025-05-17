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
          <div className="ml-[275px] flex-1 border-r border-gray-800">
            <main className="max-w-2xl mx-auto">
              {children}
            </main>
          </div>

          {/* 右侧边栏 */}
          <div className="w-[350px] fixed right-0 h-screen p-4 hidden xl:block">
            <div className="sticky top-4">
              <div className="bg-gray-900 rounded-2xl p-4">
                <h2 className="text-xl font-bold mb-4">热门资源</h2>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-3 hover:bg-gray-800 rounded-xl transition-colors cursor-pointer">
                      <h3 className="font-medium">热门论文 #{i}</h3>
                      <p className="text-sm text-gray-400 mt-1">被引用 1.2k 次</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout; 