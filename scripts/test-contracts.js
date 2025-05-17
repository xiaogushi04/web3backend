const hre = require("hardhat");

async function main() {
  console.log("开始测试合约功能...");

  // 获取已部署的合约地址
  const academicNFTAddress = "0x8e529c2F3a7B6297abaAFBfBB86D58B4D2A551BD";
  const referenceAddress = "0xce3571085c7a2268Bd389D806eD6CB54E90Af8A4";

  // 获取合约实例
  const AcademicNFT = await hre.ethers.getContractFactory("AcademicNFT");
  const ReferenceRecord = await hre.ethers.getContractFactory("ReferenceRecord");
  
  const academicNFT = await AcademicNFT.attach(academicNFTAddress);
  const referenceRecord = await ReferenceRecord.attach(referenceAddress);

  // 获取测试账户
  const owner = await hre.ethers.provider.getSigner();
  const ownerAddress = await owner.getAddress();
  console.log(`\n测试账户地址：`);
  console.log(`Owner: ${ownerAddress}`);

  try {
    // 测试 AcademicNFT 功能
    console.log("\n测试 AcademicNFT 功能...");
    
    // 测试批量铸造 NFT
    console.log("\n1. 测试批量铸造 NFT...");
    const nftData = [
      {
        title: "测试论文 1",
        description: "这是第一篇测试论文",
        ipfsHash: "ipfs://QmTest123",
        resourceType: 0,
        authors: [ownerAddress]
      },
      {
        title: "测试论文 2",
        description: "这是第二篇测试论文",
        ipfsHash: "ipfs://QmTest456",
        resourceType: 0,
        authors: [ownerAddress]
      }
    ];
    
    for (const data of nftData) {
      const mintTx = await academicNFT.mintResource(
        ownerAddress,
        data.title,
        data.description,
        data.ipfsHash,
        data.resourceType,
        data.authors
      );
      await mintTx.wait();
      console.log(`NFT "${data.title}" 铸造成功！`);
    }

    // 获取用户拥有的所有 NFT
    console.log("\n2. 测试获取用户拥有的所有 NFT...");
    const userNFTs = await academicNFT.getAuthorResources(ownerAddress);
    console.log(`用户 ${ownerAddress} 拥有的 NFT 数量: ${userNFTs.length}`);
    for (const tokenId of userNFTs) {
      const metadata = await academicNFT.getResourceMetadata(tokenId);
      console.log(`NFT #${tokenId}: ${metadata.title}`);
    }

    // 测试更新 NFT 元数据
    console.log("\n3. 测试更新 NFT 元数据...");
    const updateTokenId = 1;
    const newTitle = "更新后的论文标题";
    const newDescription = "这是更新后的论文描述";
    const updateTx = await academicNFT.updateResourceIpfsHash(
      updateTokenId,
      "ipfs://QmTest789"
    );
    await updateTx.wait();
    console.log(`NFT #${updateTokenId} 元数据更新成功！`);

    // 验证更新后的元数据
    const updatedMetadata = await academicNFT.getResourceMetadata(updateTokenId);
    console.log("\n更新后的 NFT 元数据：");
    console.log(`标题: ${updatedMetadata.title}`);
    console.log(`描述: ${updatedMetadata.description}`);
    console.log(`IPFS Hash: ${updatedMetadata.ipfsHash}`);

    // 测试 ReferenceRecord 功能
    console.log("\n测试 ReferenceRecord 功能...");
    
    // 创建多个引用记录
    console.log("\n1. 测试创建多个引用记录...");
    const sourceId = 1;
    const targetId = 2;
    const refDescriptions = [
      "这是一条测试引用 1",
      "这是一条测试引用 2",
      "这是一条测试引用 3"
    ];
    
    const referenceIds = [];
    for (const description of refDescriptions) {
      const createRefTx = await referenceRecord.createReference(
        sourceId,
        targetId,
        description
      );
      const createRefReceipt = await createRefTx.wait();
      
      const referenceCreatedEvent = createRefReceipt.logs.find(
        log => log.fragment && log.fragment.name === 'ReferenceCreated'
      );
      const referenceId = referenceCreatedEvent.args.referenceId;
      referenceIds.push(referenceId);
      console.log(`引用记录创建成功！引用 ID: ${referenceId}`);
    }

    // 获取引用记录详情
    console.log("\n2. 测试获取引用记录详情...");
    for (const refId of referenceIds) {
      const refDetails = await referenceRecord.getReference(refId);
      console.log(`\n引用记录 #${refId} 详情：`);
      console.log(`源资源 ID: ${refDetails.sourceTokenId}`);
      console.log(`目标资源 ID: ${refDetails.targetTokenId}`);
      console.log(`描述: ${refDetails.description}`);
      console.log(`创建者: ${refDetails.referencer}`);
      console.log(`创建时间: ${new Date(Number(refDetails.timestamp) * 1000).toLocaleString()}`);
      console.log(`状态: ${refDetails.isValid ? "有效" : "无效"}`);
    }

    // 获取资源的所有引用记录
    console.log("\n3. 测试获取资源的所有引用记录...");
    const resourceRefs = await referenceRecord.getResourceReferences(sourceId);
    console.log(`资源 #${sourceId} 的所有引用记录 ID: ${resourceRefs.join(", ")}`);

    // 获取用户的所有引用记录
    console.log("\n4. 测试获取用户的所有引用记录...");
    const userRefs = await referenceRecord.getUserReferences(ownerAddress);
    console.log(`用户 ${ownerAddress} 的所有引用记录 ID: ${userRefs.join(", ")}`);

    // 获取资源的有效引用数量
    console.log("\n5. 测试获取资源的有效引用数量...");
    const validRefCount = await referenceRecord.getValidReferenceCount(sourceId);
    console.log(`资源 #${sourceId} 的有效引用数量: ${validRefCount}`);

    // 测试使部分引用记录失效
    console.log("\n6. 测试使部分引用记录失效...");
    const invalidateRefTx = await referenceRecord.invalidateReference(referenceIds[0]);
    await invalidateRefTx.wait();
    console.log(`引用记录 #${referenceIds[0]} 已设为失效`);

    // 再次获取资源的有效引用数量
    const newValidRefCount = await referenceRecord.getValidReferenceCount(sourceId);
    console.log(`资源 #${sourceId} 的新有效引用数量: ${newValidRefCount}`);

  } catch (error) {
    console.error("\n测试过程中出现错误：");
    console.error(error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 