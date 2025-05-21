const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const accessTokenAddress = "0xfEb36e211b349E13Bd46647c9E222352636a28AC";
//   const accessTokenAddress = "0xF754d359Ec0B769Cd7De1FF9190d8C8f599eaa04";
  // 获取AccessToken合约实例
  const accessToken = await ethers.getContractAt("AccessToken", accessTokenAddress);
  
  // 检查资源ID 2的配置
  const resourceId = 1;
  try {
    console.log("正在检查资源配置...");
    console.log("合约地址:", accessTokenAddress);
    console.log("资源ID:", resourceId);
    
    const config = await accessToken.getResourceAccessConfig(resourceId);
    
    console.log("\n资源配置详情:");
    console.log("----------------------------------------");
    console.log(`最大访问权数量: ${config.maxAccessTokens.toString()}`);
    console.log(`当前访问权数量: ${config.currentAccessTokens.toString()}`);
    console.log(`价格: ${formatEther(config.price)} ETH`);
    console.log(`是否激活: ${config.isActive}`);
    console.log("----------------------------------------");

    if (config.maxAccessTokens.toString() === "0") {
      console.log("\n警告: 该资源可能未配置，因为最大访问权数量为0");
    }
  } catch (error) {
    console.error("\n检查资源配置时出错:");
    if (error.reason) {
      console.error("错误原因:", error.reason);
    } else {
      console.error("错误信息:", error.message);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 