// const { ethers, upgrades } = require("hardhat");

// async function main() {
//   // 1. Получаем вашу фабрику контрактов
//   const SLCFactory = await ethers.getContractFactory("SLC_contract");
  
//   // 2. Адрес реального Chainlink (для теста можете указать mockPriceFeed), 
//   //    но в реальном случае — адрес реального Chainlink Oracle в Celo, если доступен
//   const priceFeedAddress = "0x1234567890abcdef1234567890abcdef12345678"; 
//   const feeCollectorAddress = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
  
//   // 3. Разворачиваем прокси (UUPS)
//   console.log("Deploying SLC_contract to Alfajores...");
//   const slc = await upgrades.deployProxy(
//     SLCFactory,
//     [priceFeedAddress, feeCollectorAddress],
//     { initializer: "initialize" }
//   );
//   await slc.deployed();

//   console.log("SLC_contract deployed at:", slc.address);
// }

// main()
//   .then(() => process.exit(0))
//   .catch(error => {
//     console.error(error);
//     process.exit(1);
//   });
