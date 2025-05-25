import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import FormData from 'form-data';
import encryptionService from '../src/services/encryption.js';
import ipfsService from '../src/services/ipfs.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testEncryption() {
    try {
        logger.info('开始加密测试...');

        // 1. 读取测试文件
        const testFilePath = path.join(__dirname, '../test-files/test-encryption.txt');
        const fileBuffer = fs.readFileSync(testFilePath);
        logger.info('测试文件读取成功');
        logger.info('测试文件内容:', fileBuffer.toString('utf8'));

        // 2. 加密文件
        logger.info('开始加密文件...');
        const encryptedFile = await encryptionService.encryptFile(fileBuffer);
        logger.info('加密文件:', encryptedFile.toString('utf8'));
        logger.info('文件加密完成');

        // 3. 上传到IPFS
        logger.info('开始上传到IPFS...');
        const { cid, size } = await ipfsService.uploadFile(encryptedFile);
        logger.info('文件上传到IPFS完成:', { cid, size });

        // 4. 固定文件
        logger.info('开始固定文件...');
        await ipfsService.pinFile(cid);
        logger.info('文件固定完成');

        // 5. 从IPFS获取文件
        logger.info('开始从IPFS获取文件...');
        const downloadedEncryptedFile = await ipfsService.getFile(cid);
        logger.info('从IPFS获取文件完成');

        // 6. 解密文件
        logger.info('开始解密文件...');
        const decryptedFile = await encryptionService.decryptFile(downloadedEncryptedFile);
        logger.info('文件解密完成');

        // 7. 验证内容
        const originalContent = fileBuffer.toString('utf8');
        const decryptedContent = decryptedFile.toString('utf8');
        
        if (originalContent === decryptedContent) {
            logger.info('测试成功！文件内容完全匹配');
            logger.info('原始内容:', originalContent);
            logger.info('解密内容:', decryptedContent);
        } else {
            logger.error('测试失败！文件内容不匹配');
            logger.error('原始内容:', originalContent);
            logger.error('解密内容:', decryptedContent);
        }

     } catch (error) {
         logger.error('测试过程中发生错误:', error);
     }
}

// 运行测试
testEncryption();