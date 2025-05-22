# Web3 学术资源访问控制系统

一个基于区块链技术的学术资源访问控制系统，通过智能合约实现资源访问权的去中心化管理。

## 核心特性

### 1. 访问权管理
- 基于 ERC-721 的访问权 NFT
- 支持访问次数限制（如：单次、多次、无限次）
- 支持访问时间限制（如：1天、7天、30天、永久）
- 支持访问权转让和交易

### 2. 资源管理
- 资源上链与元数据管理
- 资源所有权追踪
- 资源引用关系管理
- 版税分成机制

### 3. 市场功能
- 资源上架与下架
- 资源购买
- 访问权购买
- 交易历史记录

## 技术实现

### 智能合约
- `AcademicNFT.sol`: 资源 NFT 合约，继承自 ERC-721
- `AccessToken.sol`: 访问权合约，实现访问控制逻辑
- `Market.sol`: 市场合约，处理交易逻辑

### 后端服务
- Node.js + Express 提供 RESTful API
- MongoDB 存储链下数据
- IPFS 存储资源内容
- 事件索引器同步链上数据

### 前端应用
- React + TypeScript 构建用户界面
- ethers.js 处理区块链交互
- wagmi + Web3Modal 实现钱包连接

## 快速开始

### 环境要求
- Node.js >= 16
- MongoDB >= 4.4
- MetaMask 钱包

### 安装部署

1. 克隆项目
```bash
git clone <repository_url>
cd web3backend
```

2. 安装依赖
```bash
# 后端
cd backend
npm install

# 前端
cd frontend
npm install
```

3. 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，配置以下内容：
# - 区块链网络配置
# - 合约地址
# - 数据库连接
# - IPFS 配置
```

4. 启动服务
```bash
# 后端
cd backend
npm run dev

# 前端
cd frontend
npm run dev
```

## 使用指南

### 资源所有者

1. 上传资源
   - 连接 MetaMask 钱包
   - 上传资源文件
   - 设置访问权限和价格

2. 管理访问权
   - 查看访问记录
   - 调整访问权限
   - 管理版税设置

### 资源访问者

1. 购买访问权
   - 浏览资源列表
   - 选择访问权类型
   - 完成支付

2. 使用资源
   - 查看访问权状态
   - 访问资源内容
   - 管理访问权

## 开发指南

### 项目结构
```
├── backend/                # 后端服务
│   ├── src/
│   │   ├── config/        # 配置文件
│   │   ├── contracts/     # 合约相关
│   │   ├── routes/        # API 路由
│   │   ├── services/      # 业务服务
│   │   └── utils/         # 工具函数
│   └── contracts/         # 智能合约
├── frontend/              # 前端应用
│   ├── src/
│   │   ├── components/    # 组件
│   │   ├── config/        # 配置文件
│   │   ├── services/      # API 服务
│   │   └── utils/         # 工具函数
└── docs/                  # 文档
```

### 开发流程

1. 合约开发
   - 编写智能合约
   - 单元测试
   - 部署到测试网

2. 后端开发
   - 实现 API 接口
   - 编写业务逻辑
   - 集成测试

3. 前端开发
   - 实现用户界面
   - 集成钱包功能
   - 对接后端 API

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件 