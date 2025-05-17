import axios from 'axios';

async function testRoutes() {
  const routes = [
    'http://localhost:3000/api/contracts/mint-with-file',
    'http://localhost:3000/contracts/mint-with-file',
    'http://localhost:3000/api/contracts',
    'http://localhost:3000/contracts'
  ];

  console.log('开始测试路由可用性...\n');

  for (const route of routes) {
    try {
      console.log(`测试路由: ${route}`);
      // 使用OPTIONS请求检查路由
      const response = await axios.request({
        method: 'OPTIONS',
        url: route,
        headers: {
          'Accept': 'application/json'
        }
      });
      console.log(`  状态: ${response.status}`);
      console.log(`  响应: ${JSON.stringify(response.data).slice(0, 100)}...\n`);
    } catch (error) {
      console.log(`  错误: ${error.message}`);
      if (error.response) {
        console.log(`  状态码: ${error.response.status}`);
        console.log(`  响应: ${JSON.stringify(error.response.data).slice(0, 100)}...\n`);
      } else {
        console.log('  无响应数据\n');
      }
    }
  }
}

testRoutes().catch(console.error); 