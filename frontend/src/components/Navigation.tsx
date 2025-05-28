import React, { useState, useEffect, ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

// 定义菜单项接口
interface MenuItem {
  id: string;
  title: string;
  icon: ReactElement;
  path?: string;
  children?: MenuItem[];
}

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

  // 菜单配置
  const menuItems: MenuItem[] = [
    {
      id: 'home',
      title: '首页',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      path: '/'
    },
    {
      id: 'resources',
      title: '资源管理',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      children: [
        {
          id: 'upload',
          title: '上传资源',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          ),
          path: '/upload'
        },
        {
          id: 'my-resources',
          title: '我的资源',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          ),
          path: '/profile'
        }
      ]
    },
    {
      id: 'about',
      title: '项目介绍',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      path: '/about'
    }
  ];

  useEffect(() => {
    // 检查是否安装了 MetaMask
    if (typeof window.ethereum !== 'undefined') {
      setIsMetaMaskInstalled(true);
    }

    // 检查是否之前手动断开过连接
    const wasManuallyDisconnected = localStorage.getItem(DISCONNECT_FLAG) === 'true';
    
    // 如果之前没有手动断开过连接，并且检测到以太坊提供商，则尝试自动连接
    if (!wasManuallyDisconnected && window.ethereum) {
      handleConnect();
    }
  }, []);

  const handleConnect = async () => {
    try {
      setShowError(false);
      setErrorMsg(null);
      await connect({ connector: injected() });
    } catch (err: any) {
      console.error('连接错误:', err);
      setShowError(true);
      setErrorMsg(err.message || '连接钱包失败');
    }
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      disconnect();
      localStorage.setItem(DISCONNECT_FLAG, 'true');
    } catch (err) {
      console.error('断开连接错误:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  const renderMenuItem = (item: MenuItem) => {
    const isActive = item.path === location.pathname;
    const baseClasses = "flex items-center space-x-2 px-4 py-2 text-sm rounded-lg transition-colors duration-200";
    const activeClasses = "bg-blue-500 text-white";
    const inactiveClasses = "text-gray-600 hover:bg-gray-100";

    return (
      <div key={item.id} className="mb-1">
        {item.path ? (
          <Link
            to={item.path}
            className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
          >
            {item.icon}
            <span>{item.title}</span>
          </Link>
        ) : (
          <div className={`${baseClasses} text-gray-900 font-medium`}>
            {item.icon}
            <span>{item.title}</span>
          </div>
        )}
        {item.children && (
          <div className="ml-4 mt-1 space-y-1">
            {item.children.map(child => renderMenuItem(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col py-4">
      <div className="flex-1 space-y-1">
        {menuItems.map(item => renderMenuItem(item))}
      </div>
    </div>
  );
};

export default Navigation; 