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
      // address: '0xFD67221D00b9b87505D679C125d1433991d982C4',
      address: '0xC9789bF6c567E6c751407d1B0Ec1bF73115031aF',
      // chainId: sepolia.id
      chainId: localhost.id,
      abi: ACADEMIC_NFT_ABI
    },
    reference: {
      // address: '0x234E1f27907e64A1DcE38F3649d88BA0f777DE23',
      address: '0xCa6b91bA27c4be2B97B090ce9CC35610ec0bfE17',
      // chainId: sepolia.id
      chainId: localhost.id
    },
    market: {
      // address: '0xAb36758DFFe216E4fb2D56e5c175F677d1D4c30c',
      address: '0x59B52cB07cEF1b301Ac74873348541f0C1EA95Df',
      // chainId: sepolia.id
      chainId: localhost.id,
      abi: MARKET_ABI
    },
    accessToken: {
      address: '0xF43cAb87E109bCEeB7271148e6449ed59d597292',
      // chainId: sepolia.id
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