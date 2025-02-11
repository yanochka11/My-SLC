import pkg from "hardhat";
const { ethers, upgrades, network } = pkg;
import { expect } from "chai";

// Функция для безопасного mint токенов, если баланс адреса меньше требуемой суммы.
async function safeMint(contract, signer, targetAddress, requiredAmount) {
  const currentBalance = await contract.balanceOf(targetAddress);
  if (currentBalance.lt(requiredAmount)) {
    const diff = requiredAmount.sub(currentBalance);
    console.log(`Minting additional ${ethers.utils.formatEther(diff)} tokens for ${targetAddress}`);
    await contract.connect(signer).mint(targetAddress, diff);
  } else {
    console.log(`Address ${targetAddress} already has sufficient tokens: ${ethers.utils.formatEther(currentBalance)}`);
  }
}

describe("AY Arabic Stablecoin – Полное тестирование", function () {
  // Таймаут 360 секунд (6 минут)
  this.timeout(360000);

  let ayArabic, config;
  let deployer, minter, burner, pauser, blocklister, oracle, user, stranger;
  // Начальный выпуск: 1,000,000 AYA (с 18 десятичными)
  const initialSupply = ethers.utils.parseEther("1000000");
  // Фиксированный адрес владельца конфигурации (как задан в AY_Configuration.sol)
  const configOwnerAddress = "0xf5304f3714760beBCe7a8eE4dcE4Be187934cf16";

  before(async function () {
    // Получаем тестовые аккаунты
    [deployer, minter, burner, pauser, blocklister, oracle, user, stranger] = await ethers.getSigners();

    // 1. Развертывание контракта конфигурации
    const ConfigFactory = await ethers.getContractFactory("AY_Configuration");
    config = await ConfigFactory.deploy();
    await config.deployed();
    console.log("Контракт конфигурации развернут по адресу:", config.address);

    // Определяем configOwnerSigner:
    // Если сеть локальная (hardhat/localhost) – используем impersonation,
    // иначе предполагаем, что аккаунт configOwner уже доступен в списке signers.
    let configOwnerSigner;
    if (network.name === "hardhat" || network.name === "localhost") {
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [configOwnerAddress],
      });
      configOwnerSigner = await ethers.getSigner(configOwnerAddress);
    } else {
      // Для alfajores configOwner должен быть добавлен через приватный ключ в hardhat.config
      const signers = await ethers.getSigners();
      configOwnerSigner = signers.find(
        signer => signer.address.toLowerCase() === configOwnerAddress.toLowerCase()
      );
      if (!configOwnerSigner) {
        throw new Error(
          "configOwner account not found among signers. Добавьте приватный ключ configOwner в hardhat.config."
        );
      }
    }

    // Проверяем баланс configOwner и пополняем только недостающую сумму (без явного задания nonce)
    const currentBalance = await ethers.provider.getBalance(configOwnerAddress);
    const requiredAmount = ethers.utils.parseEther("1");
    if (currentBalance.lt(requiredAmount)) {
      const difference = requiredAmount.sub(currentBalance);
      console.log(`Funding config owner with ${ethers.utils.formatEther(difference)} CELO`);
      try {
        const tx = await deployer.sendTransaction({
          to: configOwnerAddress,
          value: difference
        });
        await tx.wait();
      } catch (error) {
        if (error.message.toLowerCase().includes("already known")) {
          console.log("Funding transaction already known, skipping.");
        } else {
          throw error;
        }
      }
      // Если сеть локальная, можно вызвать майнинг нового блока
      if (network.name === "hardhat" || network.name === "localhost") {
        await network.provider.send("evm_mine");
      }
    } else {
      console.log("Config owner balance is sufficient:", ethers.utils.formatEther(currentBalance));
    }

    // Выполняем административные вызовы через configOwner
    await config.connect(configOwnerSigner).setBrokerAddress(minter.address);
    await config.connect(configOwnerSigner).setValidatorsAddress(minter.address);
    await config.connect(configOwnerSigner).setExchangeAddress(burner.address);
    await config.connect(configOwnerSigner).setFeeWrapper(deployer.address);

    // 2. Развертывание контракта AY Arabic через UUPS‑прокси с начальным выпуском
    const AYArabicFactory = await ethers.getContractFactory("AY_ArabicTokenV2");
    ayArabic = await upgrades.deployProxy(
      AYArabicFactory,
      ["AY Arabic", "AYA", initialSupply, minter.address, minter.address, burner.address],
      { initializer: "initialize" }
    );
    await ayArabic.deployed();
    console.log("Контракт AY Arabic развернут по адресу:", ayArabic.address);

    // 3. Назначение дополнительных ролей через AccessControl
    const UPGRADE_ROLE = await ayArabic.UPGRADE_ROLE();
    const PAUSE_ROLE = await ayArabic.PAUSE_ROLE();
    const BLOCKLIST_ROLE = await ayArabic.BLOCKLIST_ROLE();
    const ORACLE_ROLE = await ayArabic.ORACLE_ROLE();
    await ayArabic.grantRole(UPGRADE_ROLE, deployer.address);
    await ayArabic.grantRole(PAUSE_ROLE, pauser.address);
    await ayArabic.grantRole(BLOCKLIST_ROLE, blocklister.address);
    await ayArabic.grantRole(ORACLE_ROLE, oracle.address);

    // 4. Установка конфигурации в AY Arabic (для функций платы за газ)
    await ayArabic.setConfiguration(config.address);
  });

  // --- Далее идут блоки тестов (код тестов остается без изменений) ---

  describe("Базовая инициализация и роли", function () {
    it("Должен иметь корректный начальный выпуск", async function () {
      const supply = await ayArabic.totalSupply();
      expect(supply).to.equal(initialSupply);
    });

    it("Deployer должен иметь роль DEFAULT_ADMIN_ROLE", async function () {
      const DEFAULT_ADMIN_ROLE = await ayArabic.DEFAULT_ADMIN_ROLE();
      expect(await ayArabic.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.equal(true);
    });
  });

  describe("Mint & Burn", function () {
    it("Должен позволять авторизованному минтеру выпускать токены", async function () {
      const mintAmount = ethers.utils.parseEther("100");
      await expect(ayArabic.connect(minter).mint(user.address, mintAmount))
        .to.emit(ayArabic, "TransferComment")
        .withArgs("Mint executed");
      console.log("Tokens minted to:", user.address);
      console.log("Token contract address:", ayArabic.address);
      const userBalance = await ayArabic.balanceOf(user.address);
      expect(userBalance).to.equal(mintAmount);
    });

    it("Должен отклонять выпуск токенов, если вызывающий не имеет роли MINTER_ROLE", async function () {
      const mintAmount = ethers.utils.parseEther("50");
      await expect(ayArabic.connect(stranger).mint(stranger.address, mintAmount))
        .to.be.reverted;
    });

    it("Должен позволять авторизованному сжигателю сжигать токены", async function () {
      const mintAmount = ethers.utils.parseEther("200");
      await ayArabic.connect(minter).mint(user.address, mintAmount);
      const userBalanceBefore = await ayArabic.balanceOf(user.address);
      const transferAmount = ethers.utils.parseEther("100");
      await ayArabic.connect(user).transfer(burner.address, transferAmount);
      const burnerBalanceBefore = await ayArabic.balanceOf(burner.address);
      await expect(ayArabic.connect(burner).burn(transferAmount))
        .to.emit(ayArabic, "TransferComment")
        .withArgs("Burn executed");
      const burnerBalanceAfter = await ayArabic.balanceOf(burner.address);
      expect(burnerBalanceAfter).to.equal(burnerBalanceBefore.sub(transferAmount));
    });

    it("Должен отклонять сжигание токенов, если вызывающий не имеет роли BURNER_ROLE", async function () {
      const burnAmount = ethers.utils.parseEther("10");
      await expect(ayArabic.connect(user).burn(burnAmount))
        .to.be.reverted;
    });

    it("Должен отклонять сжигание токенов, если баланс недостаточен", async function () {
      const excessiveAmount = ethers.utils.parseEther("10000");
      await expect(ayArabic.connect(burner).burn(excessiveAmount))
        .to.be.reverted;
    });
  });

  describe("Pause & Blocklist", function () {
    it("Должен блокировать переводы при паузе и разрешать после снятия паузы", async function () {
      await ayArabic.connect(pauser).pause();
      await expect(
        ayArabic.transfer(user.address, ethers.utils.parseEther("10"))
      ).to.be.revertedWith("AY_ArabicTokenV2: Transfers are paused");
      await ayArabic.connect(pauser).unpause();
      await expect(
        ayArabic.transfer(user.address, ethers.utils.parseEther("10"))
      ).to.emit(ayArabic, "Transfer");
    });

    it("Должен блокировать и разблокировать адреса", async function () {
      await ayArabic.connect(blocklister).blockAccount(user.address);
      expect(await ayArabic.isBlocked(user.address)).to.equal(true);
      await expect(
        ayArabic.connect(user).transfer(minter.address, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("AY_ArabicTokenV2: Sender is blocked");
      await expect(
        ayArabic.connect(blocklister).blockAccount(user.address)
      ).to.be.reverted;
      await ayArabic.connect(blocklister).unblockAccount(user.address);
      expect(await ayArabic.isBlocked(user.address)).to.equal(false);
      await expect(
        ayArabic.connect(blocklister).unblockAccount(user.address)
      ).to.be.reverted;
    });
  });

  describe("Функции управления платой за газ", function () {
    it("Должен списывать фиксированную плату за газ с баланса пользователя", async function () {
      const feeValue = await config.fixedGasFee();
      const amount = ethers.utils.parseEther("10");
      const currentUserBalance = await ayArabic.balanceOf(user.address);
      if (currentUserBalance.lt(amount)) {
        await ayArabic.connect(minter).mint(user.address, amount.sub(currentUserBalance));
      }
      const balanceBefore = await ayArabic.balanceOf(user.address);
      await ayArabic.connect(deployer).debitGasFees(user.address, feeValue);
      const balanceAfter = await ayArabic.balanceOf(user.address);
      expect(balanceBefore.sub(balanceAfter)).to.equal(feeValue);
    });

    it("Должен отклонять списание платы за газ при неверном значении", async function () {
      const wrongFee = ethers.utils.parseEther("0.05");
      await expect(
        ayArabic.connect(deployer).debitGasFees(user.address, wrongFee)
      ).to.be.revertedWith("Invalid fee value");
    });

    it("Должен распределять списанную плату за газ корректно", async function () {
      const feeValue = await config.fixedGasFee();
      const refundAmount = feeValue.mul(40).div(100);
      const tipAmount = feeValue.mul(30).div(100);
      const baseFeeAmount = feeValue.sub(refundAmount).sub(tipAmount);
      expect(refundAmount.add(tipAmount).add(baseFeeAmount)).to.equal(feeValue);
      const collectorAddress = await config.gasFeeCollector();
      const currentCollectorBalance = await ayArabic.balanceOf(collectorAddress);
      if (currentCollectorBalance.lt(feeValue)) {
        await ayArabic.connect(minter).mint(collectorAddress, feeValue.sub(currentCollectorBalance));
      }
      const collectorBalanceBefore = await ayArabic.balanceOf(collectorAddress);
      await ayArabic.connect(deployer).creditGasFees(
        user.address,
        minter.address,
        burner.address,
        refundAmount,
        tipAmount,
        baseFeeAmount
      );
      const collectorBalanceAfter = await ayArabic.balanceOf(collectorAddress);
      expect(collectorBalanceBefore.sub(collectorBalanceAfter)).to.equal(feeValue);
    });
  });

  describe("Permit (EIP-2612) Функциональность", function () {
    it("Должен позволять gasless-одобрения через permit", async function () {
      const name = "AY Arabic";
      const version = "1";
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const verifyingContract = ayArabic.address;
      const domain = { name, version, chainId, verifyingContract };
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };
      const owner = user.address;
      const spender = minter.address;
      const value = ethers.utils.parseEther("50");
      const nonce = await ayArabic.nonces(owner);
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const message = {
        owner,
        spender,
        value: value.toString(),
        nonce: nonce.toString(),
        deadline
      };
      const signature = await user._signTypedData(domain, types, message);
      const { v, r, s } = ethers.utils.splitSignature(signature);
      await expect(
        ayArabic.connect(minter).permit(owner, spender, value, deadline, v, r, s)
      ).to.not.be.reverted;
      const nonceAfter = await ayArabic.nonces(owner);
      expect(nonceAfter).to.equal(nonce.add(1));
      const allowance = await ayArabic.allowance(owner, spender);
      expect(allowance).to.equal(value);
    });

    it("Должен отклонять permit, если срок действия истёк", async function () {
      const name = "AY Arabic";
      const version = "1";
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const verifyingContract = ayArabic.address;
      const domain = { name, version, chainId, verifyingContract };
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };
      const owner = user.address;
      const spender = minter.address;
      const value = ethers.utils.parseEther("50");
      const nonce = await ayArabic.nonces(owner);
      const deadline = Math.floor(Date.now() / 1000) - 100;
      const message = {
        owner,
        spender,
        value: value.toString(),
        nonce: nonce.toString(),
        deadline
      };
      const signature = await user._signTypedData(domain, types, message);
      const { v, r, s } = ethers.utils.splitSignature(signature);
      await expect(
        ayArabic.connect(minter).permit(owner, spender, value, deadline, v, r, s)
      ).to.be.reverted;
    });

    it("Должен отклонять permit с некорректной подписью", async function () {
      const name = "AY Arabic";
      const version = "1";
      const chainId = (await ethers.provider.getNetwork()).chainId;
      const verifyingContract = ayArabic.address;
      const domain = { name, version, chainId, verifyingContract };
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };
      const owner = user.address;
      const spender = minter.address;
      const value = ethers.utils.parseEther("50");
      const nonce = await ayArabic.nonces(owner);
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const message = {
        owner,
        spender,
        value: value.toString(),
        nonce: nonce.toString(),
        deadline
      };
      const badMessage = { ...message, value: ethers.utils.parseEther("51").toString() };
      const signature = await user._signTypedData(domain, types, badMessage);
      const { v, r, s } = ethers.utils.splitSignature(signature);
      await expect(
        ayArabic.connect(minter).permit(owner, spender, value, deadline, v, r, s)
      ).to.be.reverted;
    });
  });

  describe("Upgradeability", function () {
    it("Должен обновлять контракт и сохранять состояние", async function () {
      const supplyBefore = await ayArabic.totalSupply();
      const AYArabicFactory = await ethers.getContractFactory("AY_ArabicTokenV2");
      const upgraded = await upgrades.upgradeProxy(ayArabic.address, AYArabicFactory);
      const supplyAfter = await upgraded.totalSupply();
      expect(supplyAfter).to.equal(supplyBefore);
    });

    it("Должен отклонять обновление контракта, если вызывающий не имеет UPGRADE_ROLE", async function () {
      const AYArabicFactory = await ethers.getContractFactory("AY_ArabicTokenV2");
      await expect(
        upgrades.upgradeProxy(ayArabic.address, AYArabicFactory.connect(stranger))
      ).to.be.reverted;
    });
  });

  describe("Проверка fallback логики прокси", function () {
    let proxy, proxyInstance;
    before(async function () {
      const implAddress = ayArabic.address;
      const adminAddress = deployer.address;
      const ProxyFactory = await ethers.getContractFactory("AYArabicProxy");
      proxy = await ProxyFactory.deploy(implAddress, adminAddress, "0x");
      await proxy.deployed();
      proxyInstance = await ethers.getContractAt("AY_ArabicTokenV2", proxy.address);
    });

    it("Fallback прокси должен делегировать вызовы к реализации", async function () {
      const VersionFactory = await ethers.getContractFactory("AY_Version");
      const versionInstance = VersionFactory.attach(proxyInstance.address);
      const ver = await versionInstance.version();
      expect(ver).to.equal("AY Arabic v1.0.0");
    });

    it("Fallback прокси должен отклонять неизвестные вызовы", async function () {
      await expect(
        proxyInstance["nonexistentFunction()"]()
      ).to.be.reverted;
    });
  });

  describe("Safe Mint for Specific Owner", function () {
    it("Должен выполнить mint для владельца 0x9dD7d6C8740AC6D6006158dEcE24F204eCE6EAA7, если баланс меньше требуемого", async function () {
      const targetOwner = "0x9dD7d6C8740AC6D6006158dEcE24F204eCE6EAA7";
      const requiredAmount = ethers.utils.parseEther("100");
      const currentBalance = await ayArabic.balanceOf(targetOwner);
      if (currentBalance.lt(requiredAmount)) {
        const diff = requiredAmount.sub(currentBalance);
        console.log(`Minting ${ethers.utils.formatEther(diff)} tokens for ${targetOwner}`);
        await ayArabic.connect(minter).mint(targetOwner, diff);
      } else {
        console.log(`Address ${targetOwner} already has sufficient tokens: ${ethers.utils.formatEther(currentBalance)}`);
      }
      const finalBalance = await ayArabic.balanceOf(targetOwner);
      expect(finalBalance.gte(requiredAmount)).to.be.true;
    });
  });
});
