import ipfsService from './services/ipfs.js';

// 生成随机文件内容
function generateRandomContent() {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    return Buffer.from(`Test file ${timestamp} - ${randomStr}`);
}

// 单个文件的上传测试
async function testSingleFile(retryCount = 2) {
    const startTime = Date.now();
    let lastError = null;
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
            // 生成随机文件内容
            const testContent = generateRandomContent();
            
            // 上传文件
            const uploadStart = Date.now();
            const { cid, size } = await ipfsService.uploadFile(testContent);
            const uploadTime = Date.now() - uploadStart;
            
            return { 
                success: true, 
                cid,
                stats: {
                    uploadTime,
                    totalTime: Date.now() - startTime,
                    size
                }
            };
        } catch (error) {
            lastError = error;
            if (attempt < retryCount) {
                await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // 减少重试延迟
                continue;
            }
        }
    }
    
    return { 
        success: false, 
        error: lastError.message,
        stats: {
            totalTime: Date.now() - startTime
        }
    };
}

// 并发测试函数
async function runConcurrencyTest(concurrency = 1000, totalFiles = 1000, batchSize = 500) {
    console.log(`开始并发测试 - 总并发数: ${concurrency}, 总文件数: ${totalFiles}, 每批大小: ${batchSize}`);
    
    const results = {
        success: 0,
        failed: 0,
        cids: [],
        errors: [],
        stats: {
            totalUploadTime: 0,
            totalTime: 0,
            totalSize: 0
        }
    };
    
    const startTime = Date.now();
    let completedFiles = 0;
    
    // 使用 Promise.allSettled 替代 Promise.all，避免一个失败影响整批
    const processBatch = async (batchSize) => {
        const batch = Array(batchSize).fill().map(() => testSingleFile());
        return Promise.allSettled(batch);
    };
    
    // 分批执行，但使用更大的批次
    for (let i = 0; i < totalFiles; i += batchSize) {
        const currentBatchSize = Math.min(batchSize, totalFiles - i);
        console.log(`\n执行第 ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalFiles/batchSize)} 批测试，本批 ${currentBatchSize} 个文件`);
        
        // 并发执行本批测试
        const batchResults = await processBatch(currentBatchSize);
        
        // 统计结果
        batchResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value.success) {
                results.success++;
                results.cids.push(result.value.cid);
                results.stats.totalUploadTime += result.value.stats.uploadTime;
                results.stats.totalSize += result.value.stats.size;
            } else {
                results.failed++;
                results.errors.push(result.status === 'rejected' ? result.reason.message : result.value.error);
            }
        });
        
        completedFiles += currentBatchSize;
        const progress = (completedFiles / totalFiles * 100).toFixed(2);
        const elapsedTime = (Date.now() - startTime) / 1000;
        const avgTimePerFile = elapsedTime / completedFiles;
        const estimatedRemaining = avgTimePerFile * (totalFiles - completedFiles);
        
        console.log(`进度: ${progress}% (${completedFiles}/${totalFiles})`);
        console.log(`本批完成 - 成功: ${batchResults.filter(r => r.status === 'fulfilled' && r.value.success).length}, 失败: ${batchResults.filter(r => r.status === 'rejected' || !r.value.success).length}`);
        console.log(`已用时间: ${elapsedTime.toFixed(2)}秒, 预计剩余: ${estimatedRemaining.toFixed(2)}秒`);
        
        // 添加短暂延迟，避免系统过载
        if (i + batchSize < totalFiles) {
            await new Promise(resolve => setTimeout(resolve, 100));  // 增加批次间延迟，因为批次更大
        }
    }
    
    // 计算最终统计
    results.stats.totalTime = Date.now() - startTime;
    results.stats.avgUploadTime = results.stats.totalUploadTime / results.success;
    results.stats.avgFileSize = results.stats.totalSize / results.success;
    
    // 打印最终结果
    console.log('\n测试完成！最终结果：');
    console.log(`总文件数: ${totalFiles}`);
    console.log(`成功: ${results.success}`);
    console.log(`失败: ${results.failed}`);
    console.log('\n性能统计：');
    console.log(`总耗时: ${(results.stats.totalTime / 1000).toFixed(2)}秒`);
    console.log(`平均上传时间: ${results.stats.avgUploadTime.toFixed(2)}ms`);
    console.log(`平均文件大小: ${(results.stats.avgFileSize / 1024).toFixed(2)}KB`);
    console.log(`总吞吐量: ${(results.stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
    
    if (results.errors.length > 0) {
        console.log('\n错误统计：');
        const errorCounts = results.errors.reduce((acc, err) => {
            acc[err] = (acc[err] || 0) + 1;
            return acc;
        }, {});
        console.log(errorCounts);
    }
    
    return results;
}

// 单个文件的下载测试
async function testSingleDownload(cid, retryCount = 2) {
    const startTime = Date.now();
    let lastError = null;
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
            // 下载文件
            const downloadStart = Date.now();
            const fileBuffer = await ipfsService.getFile(cid);
            const downloadTime = Date.now() - downloadStart;
            
            return { 
                success: true, 
                stats: {
                    downloadTime,
                    totalTime: Date.now() - startTime,
                    size: fileBuffer.length
                }
            };
        } catch (error) {
            lastError = error;
            if (attempt < retryCount) {
                await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                continue;
            }
        }
    }
    
    return { 
        success: false, 
        error: lastError.message,
        stats: {
            totalTime: Date.now() - startTime
        }
    };
}

// 下载并发测试函数
async function runDownloadTest(cids, batchSize = 500) {
    console.log(`开始下载并发测试 - 总文件数: ${cids.length}, 每批大小: ${batchSize}`);
    
    const results = {
        success: 0,
        failed: 0,
        errors: [],
        stats: {
            totalDownloadTime: 0,
            totalTime: 0,
            totalSize: 0
        }
    };
    
    const startTime = Date.now();
    let completedFiles = 0;
    
    // 使用 Promise.allSettled 处理并发下载
    const processBatch = async (batchCids) => {
        const batch = batchCids.map(cid => testSingleDownload(cid));
        return Promise.allSettled(batch);
    };
    
    // 分批执行下载
    for (let i = 0; i < cids.length; i += batchSize) {
        const currentBatchCids = cids.slice(i, i + batchSize);
        console.log(`\n执行第 ${Math.floor(i/batchSize) + 1}/${Math.ceil(cids.length/batchSize)} 批下载，本批 ${currentBatchCids.length} 个文件`);
        
        // 并发执行本批下载
        const batchResults = await processBatch(currentBatchCids);
        
        // 统计结果
        batchResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value.success) {
                results.success++;
                results.stats.totalDownloadTime += result.value.stats.downloadTime;
                results.stats.totalSize += result.value.stats.size;
            } else {
                results.failed++;
                results.errors.push(result.status === 'rejected' ? result.reason.message : result.value.error);
            }
        });
        
        completedFiles += currentBatchCids.length;
        const progress = (completedFiles / cids.length * 100).toFixed(2);
        const elapsedTime = (Date.now() - startTime) / 1000;
        const avgTimePerFile = elapsedTime / completedFiles;
        const estimatedRemaining = avgTimePerFile * (cids.length - completedFiles);
        
        console.log(`进度: ${progress}% (${completedFiles}/${cids.length})`);
        console.log(`本批完成 - 成功: ${batchResults.filter(r => r.status === 'fulfilled' && r.value.success).length}, 失败: ${batchResults.filter(r => r.status === 'rejected' || !r.value.success).length}`);
        console.log(`已用时间: ${elapsedTime.toFixed(2)}秒, 预计剩余: ${estimatedRemaining.toFixed(2)}秒`);
        
        // 添加短暂延迟，避免系统过载
        if (i + batchSize < cids.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // 计算最终统计
    results.stats.totalTime = Date.now() - startTime;
    results.stats.avgDownloadTime = results.stats.totalDownloadTime / results.success;
    results.stats.avgFileSize = results.stats.totalSize / results.success;
    
    // 打印最终结果
    console.log('\n下载测试完成！最终结果：');
    console.log(`总文件数: ${cids.length}`);
    console.log(`成功: ${results.success}`);
    console.log(`失败: ${results.failed}`);
    console.log('\n性能统计：');
    console.log(`总耗时: ${(results.stats.totalTime / 1000).toFixed(2)}秒`);
    console.log(`平均下载时间: ${results.stats.avgDownloadTime.toFixed(2)}ms`);
    console.log(`平均文件大小: ${(results.stats.avgFileSize / 1024).toFixed(2)}KB`);
    console.log(`总吞吐量: ${(results.stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
    
    if (results.errors.length > 0) {
        console.log('\n错误统计：');
        const errorCounts = results.errors.reduce((acc, err) => {
            acc[err] = (acc[err] || 0) + 1;
            return acc;
        }, {});
        console.log(errorCounts);
    }
    
    return results;
}

// 运行测试
console.log('开始测试...');

// 先运行上传测试
runConcurrencyTest(1000, 1000, 500)
    .then(uploadResults => {
        console.log('\n上传测试完成！');
        
        // 使用上传测试得到的CIDs进行下载测试
        if (uploadResults.cids.length > 0) {
            console.log('\n开始下载测试...');
            return runDownloadTest(uploadResults.cids, 500);
        } else {
            throw new Error('没有可用的CIDs进行下载测试');
        }
    })
    .then(downloadResults => {
        console.log('\n下载测试完成！');
        process.exit(0);
    })
    .catch(error => {
        console.error('测试过程中发生错误:', error);
        process.exit(1);
    }); 