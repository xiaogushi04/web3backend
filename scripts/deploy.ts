import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  // 部署 AcademicNFT 合约
  const AcademicNFT = await ethers.getContractFactory("AcademicNFT");
  const academicNFT = await AcademicNFT.deploy();
  await academicNFT.waitForDeployment();
  console.log("AcademicNFT deployed to:", await academicNFT.getAddress());

  // 部署 ReferenceRecord 合约
  const ReferenceRecord = await ethers.getContractFactory("ReferenceRecord");
  const referenceRecord = await ReferenceRecord.deploy();
  await referenceRecord.waitForDeployment();
  console.log("ReferenceRecord deployed to:", await referenceRecord.getAddress());

  // 部署 AcademicMarket 合约
  const [deployer] = await ethers.getSigners();
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  const AcademicMarket = await ethers.getContractFactory("AcademicMarket");
  const academicMarket = await AcademicMarket.deploy(feeRecipient);
  await academicMarket.waitForDeployment();
  console.log("AcademicMarket deployed to:", await academicMarket.getAddress());

  // 保存合约地址到环境变量
  const envPath = '.env';
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  
  const newEnvContent = `
# Contract Addresses
ACADEMIC_NFT_ADDRESS=${await academicNFT.getAddress()}
REFERENCE_RECORD_ADDRESS=${await referenceRecord.getAddress()}
ACADEMIC_MARKET_ADDRESS=${await academicMarket.getAddress()}
`;

  fs.writeFileSync(envPath, envContent + newEnvContent);
  console.log("Contract addresses saved to .env file");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 