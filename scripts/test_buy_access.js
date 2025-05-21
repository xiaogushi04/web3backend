const { ethers } = require("hardhat");

async function main() {
  // 替换为你的合约地址
  const marketAddress = "0x2bfB5463730F4Ef0d770f2B641489025B888b408";
  const accessTokenAddress = "0x62ea8Db003FaDEe728f635Cc90a99F0b02c79487";

  // 获取deployer账户
  const [deployer] = await ethers.getSigners();
  console.log("使用账户:", deployer.address);

  // 获取Market合约实例
  const market = await ethers.getContractAt("AcademicMarket", marketAddress);

  // 参数
  const resourceId = 1;
  const duration = 30;
  const maxUses = 10;
  const price = ethers.utils.parseEther("0.5");

  // 调用buyAccessToken并捕获revert原因
  try {
    const tx = await market.connect(deployer).buyAccessToken(
      resourceId,
      duration,
      maxUses,
      { value: price, gasLimit: 500000 }
    );
    console.log("交易已发送，hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("交易已确认，区块:", receipt.blockNumber);
  } catch (error) {
    if (error.error && error.error.data && error.error.data.message) {
      console.error("Revert reason:", error.error.data.message);
    } else if (error.reason) {
      console.error("Revert reason:", error.reason);
    } else if (error.message) {
      console.error("Error message:", error.message);
    } else {
      console.error("未知错误:", error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 