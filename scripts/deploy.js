// scripts/deploy.js
const { ethers, upgrades } = require("hardhat");

async function main() {
  // Get the deployer account from your environment
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy the configuration contract
  const ConfigFactory = await ethers.getContractFactory("AY_Configuration");
  const config = await ConfigFactory.deploy();
  await config.deployed();
  console.log("Configuration deployed at:", config.address);

  // Set configuration parameters (for testing, we use deployer)
  await config.setBrokerAddress(deployer.address);
  await config.setValidatorsAddress(deployer.address);
  await config.setExchangeAddress(deployer.address);
  await config.setFeeWrapper(deployer.address);

  // Deploy the AY Arabic token implementation via UUPS proxy with initial supply = 0
  const AYArabicFactory = await ethers.getContractFactory("AY_ArabicTokenV2");
  const initialSupply = ethers.utils.parseEther("0");
  const ayArabic = await upgrades.deployProxy(AYArabicFactory, [
    "AY Arabic", "AYA", initialSupply, deployer.address, deployer.address, deployer.address
  ], { initializer: "initialize" });
  await ayArabic.deployed();
  console.log("AY Arabic deployed at:", ayArabic.address);

  // Set configuration in the AY Arabic contract (for gas fee extension)
  const tx = await ayArabic.setConfiguration(config.address);
  await tx.wait();
  console.log("Configuration set in AY Arabic contract.");

  // Mint 1,000,000 AYA tokens
  const mintAmount = ethers.utils.parseEther("1000000");
  const mintTx = await ayArabic.mint(deployer.address, mintAmount);
  await mintTx.wait();
  const balance = await ayArabic.balanceOf(deployer.address);
  console.log("Deployer balance after minting 1,000,000 AYA tokens:", ethers.utils.formatEther(balance));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment error:", error);
    process.exit(1);
  });
