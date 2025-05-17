import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

// 定义本地存储键名
const DISCONNECT_FLAG = 'wallet_manual_disconnect';

const Navigation: React.FC = () => {
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const { connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [showError, setShowError] = useState(false);
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // 检测MetaMask账户更改事件
  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      console.log('MetaMask账户已更改:', accounts);
      
      // 如果账户列表为空，则可能是断开连接了
      if (!accounts || accounts.length === 0) {
        console.log('MetaMask账户断开连接');
        disconnect();
      }
    };
    
    // 检测网络更改事件
    const handleChainChanged = () => {
      console.log('链已更改，刷新页面');
      window.location.reload();
    };
    
    if (window.ethereum && typeof window.ethereum === 'object') {
      // 确保ethereum对象及其方法存在
      const ethereum = window.ethereum as any;
      if (typeof ethereum.on === 'function') {
        // 添加事件监听器
        ethereum.on('accountsChanged', handleAccountsChanged);
        ethereum.on('chainChanged', handleChainChanged);
      }
    }
    
    return () => {
      // 清理事件监听器
      if (window.ethereum && typeof window.ethereum === 'object') {
        const ethereum = window.ethereum as any;
        if (typeof ethereum.removeListener === 'function') {
          ethereum.removeListener('accountsChanged', handleAccountsChanged);
          ethereum.removeListener('chainChanged', handleChainChanged);
        }
      }
    };
  }, [disconnect]);

  // 检查MetaMask是否已安装
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      setIsMetaMaskInstalled(
        'isMetaMask' in window.ethereum && Boolean(window.ethereum.isMetaMask)
      );
    }
  }, []);

  // 显示错误
  useEffect(() => {
    if (error) {
      console.error('连接错误:', error.message);
      setErrorMsg(error.message);
      setShowError(true);
    }
  }, [error]);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/', label: '首页' },
    { path: '/upload', label: '上传资源' },
    { path: '/profile', label: '个人中心' }
  ];

  // 连接钱包 - 直接使用原生MetaMask API
  const handleConnectWallet = async () => {
    try {
      console.log('开始连接钱包...');
      setShowError(false);
      setErrorMsg(null);
      
      if (!window.ethereum) {
        const error = 'MetaMask未安装';
        console.error(error);
        setErrorMsg(error);
        window.open('https://metamask.io/download/', '_blank');
        return;
      }
      
      // 如果已经连接，就不再重复连接
      if (isConnected && address) {
        console.log('已经连接到钱包:', address);
        return;
      }
      
      // 通过原生方式直接与MetaMask交互，绕过wagmi以确保显示账户选择
      const ethereum = window.ethereum as any;
      
      try {
        // 直接请求MetaMask选择账户
        const accounts = await ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        console.log('获取到的账户:', accounts);
        
        if (!accounts || accounts.length === 0) {
          setErrorMsg('未选择账户');
          return;
        }
        
        // 检查是否已经连接到获取的账户
        if (isConnected && address && accounts[0].toLowerCase() === address.toLowerCase()) {
          console.log('已经连接到选择的账户:', address);
          return;
        }
        
        // 现在使用wagmi来更新连接状态
        const connector = injected();
        connect({ connector });
      } catch (err: any) {
        console.error('MetaMask连接错误:', err);
        setErrorMsg(err?.message || '连接钱包失败');
        setShowError(true);
      }
    } catch (err: any) {
      console.error('连接失败:', err);
      setErrorMsg(err?.message || '操作失败');
      setShowError(true);
    }
  };
  
  // 断开连接 - 直接使用原生MetaMask API
  const handleDisconnect = async () => {
    try {
      console.log('断开钱包连接...');
      setDisconnecting(true);
      setErrorMsg(null);
      
      // 使用wagmi断开
      disconnect();
      
      // 尝试清除MetaMask会话，强制下次连接时显示账户选择
      if (window.ethereum && typeof window.ethereum.request === 'function') {
        try {
          // 由于MetaMask原生不支持断开连接API，这里我们强制刷新页面
          // 这将清除应用状态，确保断开连接状态
          setTimeout(() => {
            window.location.reload();
          }, 300);
        } catch (err) {
          console.warn('清除连接状态失败:', err);
        }
      }
    } catch (error: any) {
      console.error('断开连接失败:', error);
      setErrorMsg(error?.message || '断开连接失败');
      setDisconnecting(false);
    }
  };

  return (
    <nav className="h-full flex flex-col justify-between p-3">
      <div>
        {/* Logo */}
        <div className="mb-6">
          <Link to="/" className="text-xl font-bold">
            学术共享
          </Link>
        </div>

        {/* 导航链接 */}
        <div className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-3 py-2 rounded-full text-base font-medium transition-colors ${
                isActive(item.path)
                  ? 'text-white'
                  : 'text-gray-400 hover:bg-gray-900 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 钱包连接按钮 */}
      <div className="mt-auto">
        {showError && errorMsg && (
          <div className="mb-3 p-2 bg-red-800/50 text-white rounded-lg text-xs">
            <p className="font-semibold">连接错误:</p>
            <p>{errorMsg}</p>
            <button 
              className="text-blue-300 underline mt-1"
              onClick={() => setShowError(false)}
            >
              关闭
            </button>
          </div>
        )}

        {isConnected ? (
          <div className="space-y-3">
            <div className="px-3 py-2 bg-gray-900 rounded-full flex items-center space-x-2">
              {isMetaMaskInstalled && (
                <img 
                  src="https://metamask.io/images/metamask-fox.svg" 
                  alt="MetaMask" 
                  className="w-4 h-4"
                />
              )}
              <span className="text-sm text-gray-400">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="w-full px-3 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors text-sm flex justify-center items-center"
            >
              {disconnecting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  断开中...
                </>
              ) : (
                '断开连接'
              )}
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={handleConnectWallet}
              disabled={isPending}
              className="w-full px-3 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors text-sm flex justify-center items-center"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  连接中...
                </>
              ) : (
                '连接钱包'
              )}
            </button>
            
            <div className="mt-1 flex justify-center">
              <button 
                onClick={() => setShowHelp(!showHelp)}
                className="text-xs text-gray-500 hover:text-gray-400"
              >
                {showHelp ? '隐藏帮助' : '需要帮助?'}
              </button>
            </div>
            
            {showHelp && (
              <div className="mt-2 p-2 bg-gray-900/70 rounded-lg text-xs text-gray-300">
                <p>连接步骤:</p>
                <ol className="list-decimal pl-4 mt-1 space-y-1">
                  <li>确保安装了MetaMask</li>
                  <li>点击"连接钱包"按钮</li>
                  <li>在MetaMask弹窗中确认连接</li>
                  <li>切换到Sepolia测试网</li>
                </ol>
                <p className="mt-2">切换账户:</p>
                <ol className="list-decimal pl-4 mt-1 space-y-1">
                  <li>点击"断开连接"</li>
                  <li>再次点击"连接钱包"</li>
                  <li>在MetaMask中选择其他账户</li>
                </ol>
              </div>
            )}
          </>
        )}

        {/* MetaMask状态指示器 */}
        {!isConnected && (
          <div className="mt-2 text-xs text-gray-500 text-center">
            {isMetaMaskInstalled ? (
              <span className="text-green-500">MetaMask 已安装</span>
            ) : (
              <a 
                href="https://metamask.io/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-yellow-500 underline"
              >
                请安装 MetaMask
              </a>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation; 