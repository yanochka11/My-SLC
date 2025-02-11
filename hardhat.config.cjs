require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY; 
// Если хотите использовать отдельный ключ для configOwner, задайте его в .env как CONFIG_OWNER_PRIVATE_KEY.
// Если CONFIG_OWNER_PRIVATE_KEY не задан, используем PRIVATE_KEY по умолчанию.
const CONFIG_OWNER_PRIVATE_KEY = process.env.CONFIG_OWNER_PRIVATE_KEY || PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    alfajores: {
      url: process.env.ALFACORES_RPC_URL || "https://alfajores-forno.celo-testnet.org",
      chainId: 44787,
      // На публичном тестнете impersonation не работает, поэтому все транзакции будут выполняться
      // от имени аккаунта, чей приватный ключ указан здесь (и должен совпадать с configOwner).
      accounts: CONFIG_OWNER_PRIVATE_KEY ? [CONFIG_OWNER_PRIVATE_KEY] : [],
      gasPrice: 1000000000 // 1 Gwei
    }
  }
};
