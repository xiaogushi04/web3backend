const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("使用账户地址部署合约:", deployer.address);

  // 部署 AcademicNFT 合约
  const AcademicNFT = await hre.ethers.getContractFactory("AcademicNFT");
  const academicNFT = await AcademicNFT.deploy();
  await academicNFT.waitForDeployment();
  console.log("AcademicNFT 合约已部署到:", await academicNFT.getAddress());

  // 部署 AccessToken 合约，传入AcademicNFT合约地址
  const AccessToken = await hre.ethers.getContractFactory("AccessToken");
  const accessToken = await AccessToken.deploy(await academicNFT.getAddress());
  await accessToken.waitForDeployment();
  console.log("AccessToken 合约已部署到:", await accessToken.getAddress());

  // 部署 Market 合约
  const Market = await hre.ethers.getContractFactory("AcademicMarket");
  const market = await Market.deploy(
    deployer.address, // feeRecipient
    await academicNFT.getAddress(), // nftContract
    await accessToken.getAddress() // accessTokenContract
  );
  await market.waitForDeployment();
  console.log("Market 合约已部署到:", await market.getAddress());

  // 设置访问权合约的所有者为 Market 合约
  const accessTokenContract = await hre.ethers.getContractAt("AccessToken", await accessToken.getAddress());
  await accessTokenContract.transferOwnership(await market.getAddress());
  console.log("AccessToken 合约所有权已转移给 Market 合约");

  // 验证合约
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("等待区块确认...");
    await market.deployTransaction.wait(6);

    console.log("开始验证合约...");
    await hre.run("verify:verify", {
      address: await academicNFT.getAddress(),
      constructorArguments: [],
    });

    await hre.run("verify:verify", {
      address: await accessToken.getAddress(),
      constructorArguments: [await academicNFT.getAddress()],
    });

    await hre.run("verify:verify", {
      address: await market.getAddress(),
      constructorArguments: [
        deployer.address,
        await academicNFT.getAddress(),
        await accessToken.getAddress(),
      ],
    });
  }

  console.log("部署完成！");
  console.log("AcademicNFT 合约地址:", await academicNFT.getAddress());
  console.log("AccessToken 合约地址:", await accessToken.getAddress());
  console.log("Market 合约地址:", await market.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


// 运行脚本
// npx hardhat run scripts/deploy.cjs --network sepolia