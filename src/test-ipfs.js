import ipfsService from './services/ipfs.js';

async function testIPFS() {
  try {
    console.log('开始测试 IPFS 服务...');

    // 测试文件内容
    const testContent = Buffer.from('Hello IPFS! 这是一个测试文件。');

    // 上传文件
    console.log('正在上传文件...');
    const { cid, size } = await ipfsService.uploadFile(testContent);
    console.log('文件上传成功！');
    console.log('CID:', cid);
    console.log('文件大小:', size, 'bytes');

    // 固定文件
    console.log('正在固定文件...');
    await ipfsService.pinFile(cid);
    console.log('文件固定成功！');

    // 获取文件
    console.log('正在获取文件...');
    const fileContent = await ipfsService.getFile(cid);
    console.log('文件获取成功！');
    console.log('文件内容:', fileContent.toString());

    console.log('IPFS 测试完成！');
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

// 运行测试
testIPFS(); 