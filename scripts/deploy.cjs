const hre = require("hardhat");

async function main() {
  console.log("开始编译合约...");
  await hre.run("compile");
  console.log("合约编译完成");

  // 1. 部署 AcademicNFT 合约
  console.log("\n开始部署 AcademicNFT 合约...");
  const AcademicNFT = await hre.ethers.getContractFactory("AcademicNFT");
  const academicNFT = await AcademicNFT.deploy();
  await academicNFT.waitForDeployment();
  const academicNFTAddress = await academicNFT.getAddress();
  console.log(`AcademicNFT 合约已部署到: ${academicNFTAddress}`);
  const academicNFTReceipt = await academicNFT.deploymentTransaction();
  if (academicNFTReceipt) {
    await academicNFTReceipt.wait(1);
  }

  // 2. 部署 AcademicNFTWithQueries 合约
  console.log("\n开始部署 AcademicNFTWithQueries 合约...");
  const AcademicNFTWithQueries = await hre.ethers.getContractFactory("AcademicNFTWithQueries");
  const academicNFTWithQueries = await AcademicNFTWithQueries.deploy();
  await academicNFTWithQueries.waitForDeployment();
  const academicNFTWithQueriesAddress = await academicNFTWithQueries.getAddress();
  console.log(`AcademicNFTWithQueries 合约已部署到: ${academicNFTWithQueriesAddress}`);
  const academicNFTWithQueriesReceipt = await academicNFTWithQueries.deploymentTransaction();
  if (academicNFTWithQueriesReceipt) {
    await academicNFTWithQueriesReceipt.wait(1);
  }

  // 3. 部署 Market 合约，依赖 AcademicNFT 地址
  console.log("\n开始部署 Market 合约...");
  const Market = await hre.ethers.getContractFactory("AcademicMarket");
  const [deployer] = await hre.ethers.getSigners();
  const feeRecipient = deployer.address;
  const market = await Market.deploy(feeRecipient, academicNFTAddress);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log(`Market 合约已部署到: ${marketAddress}`);
  const marketReceipt = await market.deploymentTransaction();
  if (marketReceipt) {
    await marketReceipt.wait(1);
  }

  // 4. 部署 Reference 合约
  console.log("\n开始部署 Reference 合约...");
  const Reference = await hre.ethers.getContractFactory("Reference");
  const reference = await Reference.deploy();
  await reference.waitForDeployment();
  const referenceAddress = await reference.getAddress();
  console.log(`Reference 合约已部署到: ${referenceAddress}`);
  const referenceReceipt = await reference.deploymentTransaction();
  if (referenceReceipt) {
    await referenceReceipt.wait(1);
  }

  // 输出所有合约地址
  console.log("\n部署完成！请将以下地址添加到 .env 文件中：");
  console.log(`ACADEMIC_NFT_ADDRESS=${academicNFTAddress}`);
  console.log(`ACADEMIC_NFT_WITH_QUERIES_ADDRESS=${academicNFTWithQueriesAddress}`);
  console.log(`MARKET_CONTRACT_ADDRESS=${marketAddress}`);
  console.log(`REFERENCE_CONTRACT_ADDRESS=${referenceAddress}`);

  // 验证合约
  // console.log("\n开始验证 AcademicNFT 合约...");
  // try {
  //   await hre.run("verify:verify", {
  //     address: academicNFTAddress,
  //     constructorArguments: [],
  //   });
  //   console.log("AcademicNFT 合约验证成功！");
  // } catch (error) {
  //   console.error("AcademicNFT 合约验证失败:", error.message);
  // }

  // console.log("\n开始验证 AcademicNFTWithQueries 合约...");
  // try {
  //   await hre.run("verify:verify", {
  //     address: academicNFTWithQueriesAddress,
  //     constructorArguments: [],
  //   });
  //   console.log("AcademicNFTWithQueries 合约验证成功！");
  // } catch (error) {
  //   console.error("AcademicNFTWithQueries 合约验证失败:", error.message);
  // }

  // console.log("\n开始验证 Market 合约...");
  // try {
  //   await hre.run("verify:verify", {
  //     address: marketAddress,
  //     constructorArguments: [feeRecipient, academicNFTAddress],
  //   });
  //   console.log("Market 合约验证成功！");
  // } catch (error) {
  //   console.error("Market 合约验证失败:", error.message);
  // }

  // console.log("\n开始验证 Reference 合约...");
  // try {
  //   await hre.run("verify:verify", {
  //     address: referenceAddress,
  //     constructorArguments: [],
  //   });
  //   console.log("Reference 合约验证成功！");
  // } catch (error) {
  //   console.error("Reference 合约验证失败:", error.message);
  // }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 


// 运行脚本
// npx hardhat run scripts/deploy.cjs --network sepolia