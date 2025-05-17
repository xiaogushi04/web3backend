/**
 * 以太坊窗口对象的类型定义
 * 扩展Window全局对象，添加ethereum属性
 */
interface EthereumProvider {
  isMetaMask?: boolean;
  chainId?: string;
  selectedAddress?: string;
  networkVersion?: string;
  version?: string;
  autoRefreshOnNetworkChange?: boolean;
  
  // 方法
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (eventName: string, handler: (...args: any[]) => void) => void;
  removeListener: (eventName: string, handler: (...args: any[]) => void) => void;
  
  // 事件
  once?: (event: string, callback: (...args: any[]) => void) => void;
  removeAllListeners?: (event: string) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {}; 