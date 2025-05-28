import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WagmiConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react';
import { injected } from 'wagmi/connectors';
import Layout from './components/Layout';
import Home from './pages/Home';
import Profile from './pages/Profile';
import UploadForm from './components/UploadForm';
import ResourceViewer from './components/ResourceViewer';
import ResourceContent from './components/ResourceContent';
import About from './pages/About';
import { ToastProvider } from './components/ToastManager';

// 项目ID - WalletConnect Cloud项目ID
// 注意：这应该是您在 https://cloud.walletconnect.com 上注册的有效项目ID
const projectId = 'aadafb1f94cb7260af9b193ad726e667';

// 配置支持的链 - 确保Sepolia在前面，作为默认链
const chains = [sepolia, mainnet] as const;

// 自定义配置
const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata: {
    name: '学术资源共享平台',
    description: '基于区块链的学术资源共享平台',
    url: window.location.origin, // 使用实际URL而不是硬编码值
    icons: [`${window.location.origin}/favicon.ico`]
  },
  // 明确指定注入连接器为主要连接方式
  connectors: [
    injected()
  ],
});

// 创建 React Query 客户端
const queryClient = new QueryClient();

// Web3Modal初始化
try {
  console.log('初始化 Web3Modal...');
  
  createWeb3Modal({ 
    wagmiConfig, 
    projectId,
    themeMode: 'dark',
    defaultChain: sepolia,
    // 优先使用MetaMask
    featuredWalletIds: [
      'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96' // MetaMask
    ]
  });
  
  console.log('Web3Modal 初始化成功');
} catch (error) {
  console.error('Web3Modal 初始化失败:', error);
}

const App: React.FC = () => {
  // 检查MetaMask是否已安装
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.ethereum) {
        console.log('检测到以太坊提供商');
        if (window.ethereum.isMetaMask) {
          console.log('检测到MetaMask插件');
          console.log('MetaMask版本:', window.ethereum.version || '未知');
        }
      } else {
        console.log('未检测到以太坊提供商，钱包连接可能不起作用');
        // 提示用户安装MetaMask可能会更好
        console.log('如果您想使用此应用，请安装MetaMask: https://metamask.io/');
      }
    }
  }, []);

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/upload" element={<UploadForm onUpload={async () => {}} />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/resource/:id" element={<ResourceViewer resourceId="" />} />
                <Route path="/resource/:id/content" element={<ResourceContent />} />
                <Route path="/about" element={<About />} />
              </Routes>
            </Layout>
          </Router>
        </ToastProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
};

export default App;
