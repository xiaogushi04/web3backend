const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  try {
  // 替换为你的合约地址
    const marketAddress = "0x59B52cB07cEF1b301Ac74873348541f0C1EA95Df";
    const accessTokenAddress = "0xF43cAb87E109bCEeB7271148e6449ed59d597292";

    // 获取账户
    const signers = await ethers.getSigners();
    const buyer = signers[3]; // 使用第二个账户（index 1）
    console.log("使用账户:", buyer.address);

  // 获取Market合约实例
  const market = await ethers.getContractAt("AcademicMarket", marketAddress);
    const accessToken = await ethers.getContractAt("AccessToken", accessTokenAddress);

  // 参数
  const resourceId = 1;
  const duration = 30;
  const maxUses = 10;

    // 获取实际价格
    const config = await accessToken.getResourceAccessConfig(resourceId);
    const price = config[2]; // 使用配置中的实际价格
    
    console.log("\n资源配置信息:");
    console.log("最大访问权数量:", config[0].toString());
    console.log("当前访问权数量:", config[1].toString());
    console.log("价格:", ethers.formatEther(price), "ETH");
    console.log("价格(wei):", price.toString());
    console.log("是否激活:", config[3]);

    // 检查买家余额
    const buyerBalance = await ethers.provider.getBalance(buyer.address);
    console.log("\n买家信息:");
    console.log("地址:", buyer.address);
    console.log("余额:", ethers.formatEther(buyerBalance), "ETH");
    console.log("余额(wei):", buyerBalance.toString());

    console.log("\n尝试购买访问权...");
    console.log("资源ID:", resourceId);
    console.log("持续时间:", duration, "天");
    console.log("最大使用次数:", maxUses);
    console.log("支付金额:", ethers.formatEther(price), "ETH");
    console.log("支付金额(wei):", price.toString());

    const tx = await market.connect(buyer).buyAccessToken(
      resourceId,
      duration,
      maxUses,
      { 
        value: price,
        gasLimit: 500000
      }
    );
    console.log("\n交易已发送，hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("交易已确认，区块:", receipt.blockNumber);
  } catch (error) {
    console.error("\n错误详情:");
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