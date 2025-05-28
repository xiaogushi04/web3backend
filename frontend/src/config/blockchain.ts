import { sepolia } from 'wagmi/chains';
import { ACADEMIC_NFT_ABI, MARKET_ABI, ACCESS_TOKEN_ABI } from './contracts';
// 定义本地 Ganache 网络
const localhost = {
  id: 1337,
  name: 'Localhost',
  network: 'localhost',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:7545'] },
    public: { http: ['http://127.0.0.1:7545'] },
  },
  blockExplorers: {
    default: { name: 'Local', url: '' },
  },
  testnet: true
};
// 区块链配置
export const blockchainConfig = {
  // 支持的链
  // supportedChains: [sepolia],
  // 默认链
  // defaultChain: sepolia,
  supportedChains: [localhost],
  defaultChain: localhost,
  // 合约地址
  contracts: {
    academicNFT: {
      address: '0x9Aa1456825D9d25b3aC6BF16F7cD659F092CFe21',
      chainId: localhost.id,
      abi: ACADEMIC_NFT_ABI
    },
    reference: {
      address: '0xCa6b91bA27c4be2B97B090ce9CC35610ec0bfE17',
      chainId: localhost.id
    },
    market: {
      address: '0xd0B19Fea580a2d5A31DAE4E313E5A8F1C63a6F68',
      chainId: localhost.id,
      abi: MARKET_ABI
    },
    accessToken: {
      address: '0x72EcaF3558100c9a61ec8f0252C508a3d05C76c3',
      chainId: localhost.id,
      abi: ACCESS_TOKEN_ABI
    }
  },
  // RPC配置
  rpc: {
    // [sepolia.id]: 'https://sepolia.infura.io/v3/8743b0b6ffd74f7b825a64dcbb98a26f'
    [localhost.id]: 'http://localhost:7545'
  }
};

// 获取当前链上的合约地址
// export const getContractAddress = (contractName: keyof typeof blockchainConfig.contracts, chainId: number = sepolia.id) => {
export const getContractAddress = (contractName: keyof typeof blockchainConfig.contracts, chainId: number = localhost.id) => {
  const contract = blockchainConfig.contracts[contractName];
  if (!contract || contract.chainId !== chainId) {
    throw new Error(`合约 ${contractName} 在链 ${chainId} 上不可用`);
  }
  return contract.address;
};

// 检查MetaMask是否已安装
export const isMetaMaskInstalled = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof window.ethereum !== 'undefined' && 
         Boolean(window.ethereum.isMetaMask);
};

// 检查是否连接到正确的网络
export const isOnSupportedNetwork = async (): Promise<boolean> => {
  if (!isMetaMaskInstalled()) return false;

  try {
    // 使用非空断言，因为我们已经在isMetaMaskInstalled中确认了ethereum存在
    const ethereum = window.ethereum!;
    if (!ethereum.request) return false;
    
    const chainId = await ethereum.request({ method: 'eth_chainId' });
    return chainId ? blockchainConfig.supportedChains.some(chain => chain.id === parseInt(chainId, 16)) : false;
  } catch (error) {
    console.error('获取链ID失败:', error);
    return false;
  }
};

// 切换到本地网络
export const switchToLocalhost = async (): Promise<boolean> => {
  if (!isMetaMaskInstalled()) return false;
  
  const ethereum = window.ethereum!;
  if (!ethereum.request) return false;

  try {
    // 尝试切换到本地网络
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${localhost.id.toString(16)}` }],
    });
    return true;
  } catch (switchError: any) {
    // 如果网络不存在，则添加网络
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${localhost.id.toString(16)}`,
              chainName: 'Localhost',
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['http://127.0.0.1:7545'],
              blockExplorerUrls: [''],
            },
          ],
        });
        return true;
      } catch (addError) {
        console.error('添加本地网络失败:', addError);
        return false;
      }
    }
    console.error('切换到本地网络失败:', switchError);
    return false;
  }
}; 