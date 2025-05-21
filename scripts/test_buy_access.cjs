const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  // 替换为你的合约地址
  const marketAddress = "0x874140eD7d9dfF05beF0d4cB420dd5F84a5257ab";
  const accessTokenAddress = "0xfEb36e211b349E13Bd46647c9E222352636a28AC";

  // 获取第二个账户（非deployer）
  const signers = await ethers.getSigners();
  const buyer = signers[3]; // 用第二个账户
  console.log("使用账户:", buyer.address);

  // 获取Market合约实例
  const market = await ethers.getContractAt("AcademicMarket", marketAddress);

  // 参数
  const resourceId = 3;
  const duration = 30;
  const maxUses = 10;
  const price = ethers.utils.parseEther("0.5");

  // 调用buyAccessToken并捕获revert原因
  try {
    console.log("尝试购买访问权...");
    console.log("资源ID:", resourceId);
    console.log("持续时间:", duration, "天");
    console.log("最大使用次数:", maxUses);
    console.log("支付金额:", ethers.utils.formatEther(price), "ETH");

    const tx = await market.connect(buyer).buyAccessToken(
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