import React from 'react';

const About: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">关于墨链文库</h1>
      
      <div className="space-y-8">
        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">项目简介</h2>
          <p className="text-gray-600 leading-relaxed">
            墨链文库是一个基于区块链技术的去中心化学术资源共享平台。我们致力于为学术研究者提供一个安全、透明、高效的资源交流平台，
            通过区块链技术确保学术成果的知识产权得到保护，同时促进学术资源的有效流通。平台将学术资源通过 NFT 形式在以太坊网络上进行
            确权和交易，实现了学术资源的数字化资产化，为知识创作者提供了新的价值实现途径。
          </p>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">技术架构</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">前端技术栈</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>React.js 构建用户界面</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>TypeScript 确保代码类型安全</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>TailwindCSS 构建现代化 UI</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>ethers.js 实现区块链交互</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">后端技术栈</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Node.js 服务器运行环境</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>MongoDB 存储链下数据</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Redis 提供缓存加速</span>
                </li>
                <li className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>IPFS 分布式文件存储</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">核心特点</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">区块链确权</h3>
              <p className="text-gray-600">利用以太坊智能合约，将学术资源铸造为 NFT，确保资源所有权和交易记录的不可篡改性。</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">加密存储</h3>
              <p className="text-gray-600">文件经加密后存储在 IPFS 网络，CID 存储在 MongoDB，确保数据安全性和去中心化。</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">高性能架构</h3>
              <p className="text-gray-600">采用 Redis 缓存加速，优化数据访问性能，提供流畅的用户体验。</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">智能合约</h3>
              <p className="text-gray-600">基于 ERC-721 标准开发的智能合约，支持资源交易和版权管理。</p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">开发团队</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3">
                赵
              </div>
              <h3 className="font-medium text-gray-900">赵璐文</h3>
              <p className="text-sm text-gray-500">后端和数据库开发</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3">
                林
              </div>
              <h3 className="font-medium text-gray-900">林祥鸿</h3>
              <p className="text-sm text-gray-500">合约和前端开发</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3">
                陈
              </div>
              <h3 className="font-medium text-gray-900">陈璟耀</h3>
              <p className="text-sm text-gray-500">前端开发</p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">项目链接</h2>
          <div className="flex items-center space-x-4">
            <a 
              href="https://github.com/y3h7rv/web3backend"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.137 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              <span>GitHub 仓库</span>
            </a>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">联系我们</h2>
          <p className="text-gray-600">
            如果您有任何问题、建议或合作意向，欢迎通过以下方式联系我们：
          </p>
          <a 
            href="mailto:contact@example.com" 
            className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 mt-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>contact@example.com</span>
          </a>
        </section>
      </div>
    </div>
  );
};

export default About; 