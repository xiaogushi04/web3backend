# Web3 学术资源交易平台

这是一个Web3学术资源交易平台的后端服务，用于管理基于区块链的学术资源NFT。

## 架构说明

### 系统架构

本项目采用区块链事件索引器架构，主要包括以下组件：

1. **区块链交互服务**：负责与智能合约的直接交互，处理铸造、引用、上架、交易等链上操作
2. **事件索引器**：监听和处理链上事件，将事件数据同步到数据库
3. **数据库存储**：使用MongoDB存储区块链事件解析后的结构化数据
4. **缓存服务**：使用Redis缓存频繁访问的数据，提高API响应速度
5. **RESTful API**：为前端提供标准的RESTful接口

### 优势

1. **高效查询**：避免直接查询区块链，大幅提高API响应速度
2. **降低成本**：减少对区块链RPC的直接调用，降低基础设施成本
3. **数据完整性**：索引器保证链上数据与数据库数据的一致性
4. **更好的可扩展性**：数据库查询支持复杂过滤、排序和分页操作

## 功能特性

- NFT资源铸造：发布学术资源并生成NFT证书
- 资源引用：创建资源之间的引用关系
- 市场交易：上架、下架和购买学术资源NFT
- 资源列表：获取所有资源、用户资源和市场资源列表
- 资源详情：获取单个资源的详细信息
- 资源历史：查看资源的转移历史和引用关系

## 技术栈

- Node.js
- Express.js
- MongoDB (数据存储)
- Redis (缓存)
- Ethers.js (区块链交互)
- IPFS (分布式文件存储)

## 目录结构

```
src/
├── app.js                  # 应用程序入口文件
├── config/                 # 配置文件
├── contracts/              # 智能合约ABI和地址
├── middleware/             # 中间件
├── models/                 # 数据库模型
├── modules/                # 功能模块
├── routes/                 # 路由定义
├── services/               # 服务实现
│   ├── cache.js            # 缓存服务
│   ├── contract.service.js # 合约交互服务
│   ├── database.js         # 数据库连接
│   ├── indexer.service.js  # 区块链事件索引器
│   ├── ipfs.js             # IPFS服务
│   └── nft.service.js      # NFT数据访问服务
├── start-indexer.js        # 独立索引器启动脚本
└── utils/                  # 工具函数
```

## 安装与设置

### 先决条件

- Node.js v16或更高版本
- MongoDB服务器
- Redis服务器
- 以太坊兼容的区块链节点（如Sepolia测试网）

### 安装步骤

1. 克隆仓库：
```bash
git clone <repository_url>
cd web3backend
```

2. 安装依赖：
```bash
npm install
```

3. 设置环境变量（创建.env文件）：
```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/web3docmarket

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# 区块链配置
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=your_private_key
ACADEMIC_NFT_CONTRACT_ADDRESS=0x12345...
CHAIN_ID=11155111
DEPLOYMENT_BLOCK=3000000

# IPFS配置
IPFS_HOST=localhost
IPFS_PORT=5001
IPFS_PROTOCOL=http

# 索引器配置
INDEXER_ENABLED=true
INDEXER_SYNC_INTERVAL=60000
```

4. 启动服务：
```bash
npm start
```

### 单独运行索引器

如果需要单独运行索引器（例如在单独的进程或服务器上），可以使用：
```bash
node src/start-indexer.js
```

## API 文档

### 资源管理

- `POST /api/contracts/mint-with-file` - 上传文件并铸造NFT
- `POST /api/contracts/mint` - 铸造NFT（IPFS哈希已存在）
- `GET /api/contracts/resource/:tokenId` - 获取资源元数据
- `GET /api/contracts/resources` - 获取所有资源列表
- `GET /api/contracts/user/:address/resources` - 获取用户的资源列表

### 引用管理

- `POST /api/contracts/reference` - 创建引用关系
- `GET /api/contracts/resource/:tokenId/references` - 获取资源的引用

### 市场功能

- `POST /api/contracts/list` - 上架NFT
- `POST /api/contracts/buy` - 购买NFT
- `GET /api/contracts/listing/:tokenId` - 获取上架详情
- `GET /api/contracts/market` - 获取市场列表

### IPFS文件管理

- `POST /api/ipfs/file` - 上传文件到IPFS

## 许可证

[MIT](LICENSE) 