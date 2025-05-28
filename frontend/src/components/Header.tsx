import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

const Header: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [disconnecting, setDisconnecting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(
    typeof window.ethereum !== 'undefined'
  );

  const handleConnect = async () => {
    try {
      await connect({ connector: injected() });
    } catch (err) {
      console.error('连接错误:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      disconnect();
      localStorage.setItem('wallet_manual_disconnect', 'true');
    } catch (err) {
      console.error('断开连接错误:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo 和项目名称 */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3">
              <svg
                className="h-8 w-8 text-blue-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <span className="text-xl font-bold text-gray-900">墨链文库</span>
            </Link>
          </div>
          
          {/* 钱包连接 */}
          <div className="flex items-center space-x-4">
            {isConnected ? (
              <div className="flex items-center space-x-2">
                <div className="px-3 py-2 bg-gray-50 rounded-lg flex items-center space-x-2 border border-gray-200">
                  {isMetaMaskInstalled && (
                    <img 
                      src="https://metamask.io/images/metamask-fox.svg" 
                      alt="MetaMask" 
                      className="w-4 h-4"
                    />
                  )}
                  <span className="text-sm text-gray-600">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-3 py-2 text-red-600 hover:text-red-700 transition-colors text-sm flex items-center hover:bg-red-50 rounded-lg border border-red-200"
                >
                  {disconnecting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      断开中...
                    </>
                  ) : '断开'}
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleConnect}
                  disabled={isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center shadow-sm"
                >
                  {isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      连接中...
                    </>
                  ) : '连接钱包'}
                </button>
                {!isMetaMaskInstalled && (
                  <button
                    onClick={() => setShowHelp(!showHelp)}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    需要帮助？
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 帮助提示弹窗 */}
      {showHelp && !isMetaMaskInstalled && (
        <div className="absolute right-4 top-16 mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200 text-sm text-gray-600 z-50">
          <p>请先安装 MetaMask 钱包插件：</p>
          <a
            href="https://metamask.io/download.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline block mt-2"
          >
            下载 MetaMask
          </a>
          <button
            onClick={() => setShowHelp(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </header>
  );
};

export default Header; 