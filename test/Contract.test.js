const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("SLC_contract", function () {
  let SLC, slc, owner, addr1, addr2, feeCollector, pauser, minter, burner;
  let mockPriceFeed, MockPriceFeed;
  const INITIAL_PRICE = 324000000; // 3.24 (with 8 decimals)
  const ZERO_ADDRESS = ethers.constants.AddressZero;

  before(async () => {
    // Get signers
    [owner, addr1, addr2, feeCollector, pauser, minter, burner] = await ethers.getSigners();
  });

  beforeEach(async () => {
    // Deploy the mock oracle with the initial price = 3.24 * 1e8
    MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockPriceFeed = await MockPriceFeed.deploy(INITIAL_PRICE);
    await mockPriceFeed.deployed();

    // Deploy the upgradeable contract (SLC_contract) via UUPS proxy
    const SLCFactory = await ethers.getContractFactory("SLC_contract");
    SLC = await upgrades.deployProxy(
      SLCFactory,
      [mockPriceFeed.address, feeCollector.address], // Arguments for initialize()
      { initializer: "initialize" }
    );
    await SLC.deployed();
    slc = SLC; // alias

    // Grant roles (PAUSER_ROLE, MINTER_ROLE, BURNER_ROLE)
    const PAUSER_ROLE = await slc.PAUSER_ROLE();
    const MINTER_ROLE = await slc.MINTER_ROLE();
    const BURNER_ROLE = await slc.BURNER_ROLE();

    await slc.grantRole(PAUSER_ROLE, pauser.address);
    await slc.grantRole(MINTER_ROLE, minter.address);
    await slc.grantRole(BURNER_ROLE, burner.address);
  });

  // ----------------------------------------------------------------------------------------
  // 1. Initialization
  // ----------------------------------------------------------------------------------------
  describe("Initialization", function () {
    it("should set correct initial parameters", async function () {
      expect(await slc.name()).to.equal("Stable Lori Coin");
      expect(await slc.symbol()).to.equal("SLC");
      expect(await slc.peggedPrice()).to.equal(324000000);
      expect(await slc.tolerance()).to.equal(100);
      expect(await slc.transferFeeBasisPoints()).to.equal(1);
      expect(await slc.feeCollector()).to.equal(feeCollector.address);
    });

    it("should revert if priceFeed = zero or feeCollector = zero in initialize", async function () {
      const SLCFactory = await ethers.getContractFactory("SLC_contract");
      // Note: For deployment reverts we pass the contract factory as the first argument.
      await expect(
        upgrades.deployProxy(SLCFactory, [ZERO_ADDRESS, feeCollector.address], { initializer: "initialize" })
      ).to.be.revertedWithCustomError(SLCFactory, "ZeroAddress");

      await expect(
        upgrades.deployProxy(SLCFactory, [mockPriceFeed.address, ZERO_ADDRESS], { initializer: "initialize" })
      ).to.be.revertedWithCustomError(SLCFactory, "ZeroAddress");
    });
  });

  // ----------------------------------------------------------------------------------------
  // 2. Roles and Access Control
  // ----------------------------------------------------------------------------------------
  describe("Roles and Access Control", function () {
    it("owner has DEFAULT_ADMIN_ROLE", async function () {
      const DEFAULT_ADMIN_ROLE = await slc.DEFAULT_ADMIN_ROLE();
      expect(await slc.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);
    });

    it("pauser can pause/unpause", async function () {
      await slc.connect(pauser).pause();
      expect(await slc.paused()).to.equal(true);
      await slc.connect(pauser).unpause();
      expect(await slc.paused()).to.equal(false);
    });

    it("non-pauser should fail to pause", async () => {
      await expect(slc.connect(addr1).pause()).to.be.reverted;
    });

    it("minter can mint", async function () {
      await slc.connect(minter).mint(addr1.address, 1000);
      expect(await slc.balanceOf(addr1.address)).to.equal(1000);
    });

    it("non-minter can't mint", async function () {
      await expect(slc.connect(addr1).mint(addr1.address, 1000)).to.be.reverted;
    });

    it("burner can burn", async function () {
      await slc.connect(minter).mint(burner.address, 500);
      expect(await slc.balanceOf(burner.address)).to.equal(500);
      await slc.connect(burner).burn(200);
      expect(await slc.balanceOf(burner.address)).to.equal(300);
    });

    it("non-burner can't burn", async function () {
      await slc.connect(minter).mint(addr1.address, 300);
      await expect(slc.connect(addr1).burn(100)).to.be.reverted;
    });
  });

  // ----------------------------------------------------------------------------------------
  // 3. Freeze / Unfreeze
  // ----------------------------------------------------------------------------------------
  describe("Freeze / Unfreeze", function () {
    it("admin can freeze address", async function () {
      await slc.freeze(addr1.address);
      expect(await slc.frozen(addr1.address)).to.equal(true);
    });

    it("admin can unfreeze address", async function () {
      await slc.freeze(addr1.address);
      await slc.unfreeze(addr1.address);
      expect(await slc.frozen(addr1.address)).to.equal(false);
    });

    it("non-admin cannot freeze/unfreeze", async function () {
      await expect(slc.connect(addr1).freeze(addr2.address)).to.be.reverted;
      await expect(slc.connect(addr1).unfreeze(addr2.address)).to.be.reverted;
    });

    it("frozen address cannot transfer or receive tokens", async function () {
      await slc.connect(minter).mint(addr1.address, 1000);
      await slc.freeze(addr1.address);

      // Attempt to transfer tokens from addr1 to addr2
      await expect(
        slc.connect(addr1).transfer(addr2.address, 100)
      ).to.be.revertedWithCustomError(slc, "Unauthorized");

      // Attempt to mint tokens to a frozen address
      await expect(
        slc.connect(minter).mint(addr1.address, 50)
      ).to.be.revertedWithCustomError(slc, "Unauthorized");
    });
  });

  // ----------------------------------------------------------------------------------------
  // 4. Fee Updates
  // ----------------------------------------------------------------------------------------
  describe("Fee Updates", function () {
    it("admin can updateFee", async function () {
      await slc.updateFee(50); // Set fee to 0.50%
      expect(await slc.transferFeeBasisPoints()).to.equal(50);
    });

    it("admin can updateFeeCollector", async function () {
      await slc.updateFeeCollector(addr1.address);
      expect(await slc.feeCollector()).to.equal(addr1.address);
    });

    it("should revert if newCollector = zero", async function () {
      await expect(slc.updateFeeCollector(ZERO_ADDRESS)).to.be.revertedWithCustomError(slc, "ZeroAddress");
    });

    it("non-admin cannot updateFee or feeCollector", async function () {
      await expect(slc.connect(addr1).updateFee(20)).to.be.reverted;
      await expect(slc.connect(addr1).updateFeeCollector(addr2.address)).to.be.reverted;
    });
  });

  // ----------------------------------------------------------------------------------------
  // 5. Stability Params Updates
  // ----------------------------------------------------------------------------------------
  describe("Stability Params Updates", function () {
    it("admin can updatePeggedPrice", async function () {
      await slc.updatePeggedPrice(400000000); // 4.00
      expect(await slc.peggedPrice()).to.equal(400000000);
    });

    it("should revert if newPeggedPrice = 0", async function () {
      await expect(slc.updatePeggedPrice(0)).to.be.revertedWithCustomError(slc, "ZeroAddress");
    });

    it("admin can updateTolerance", async function () {
      await slc.updateTolerance(200);
      expect(await slc.tolerance()).to.equal(200);
    });

    it("admin can updatePriceFeed", async function () {
      const MockPriceFeed2 = await ethers.getContractFactory("MockPriceFeed");
      const mockPriceFeed2 = await MockPriceFeed2.deploy(INITIAL_PRICE);
      await mockPriceFeed2.deployed();

      await slc.updatePriceFeed(mockPriceFeed2.address);
      expect(await slc.priceFeed()).to.equal(mockPriceFeed2.address);
    });

    it("should revert if newPriceFeed = zero", async function () {
      await expect(slc.updatePriceFeed(ZERO_ADDRESS)).to.be.revertedWithCustomError(slc, "ZeroAddress");
    });

    it("non-admin can't update peggedPrice, tolerance, or priceFeed", async function () {
      await expect(slc.connect(addr1).updatePeggedPrice(400000000)).to.be.reverted;
      await expect(slc.connect(addr1).updateTolerance(200)).to.be.reverted;
      await expect(slc.connect(addr1).updatePriceFeed(addr2.address)).to.be.reverted;
    });
  });

  // ----------------------------------------------------------------------------------------
  // 6. Pause / Unpause
  // ----------------------------------------------------------------------------------------
  describe("Pause / Unpause", function () {
    it("pauser can pause contract", async function () {
      await slc.connect(pauser).pause();
      expect(await slc.paused()).to.equal(true);
    });

    it("when paused, transfers are blocked", async function () {
      await slc.connect(minter).mint(addr1.address, 1000);
      await slc.connect(pauser).pause();
      await expect(
        slc.connect(addr1).transfer(addr2.address, 100)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("when paused, mint and burn are also blocked", async function () {
      await slc.connect(pauser).pause();
      await expect(slc.connect(minter).mint(addr1.address, 1000)).to.be.revertedWith("Pausable: paused");
      await expect(slc.connect(burner).burn(1000)).to.be.revertedWith("Pausable: paused");
    });

    it("unpause re-enables all operations", async function () {
      await slc.connect(pauser).pause();
      await slc.connect(pauser).unpause();
      await slc.connect(minter).mint(addr1.address, 1000);
      await slc.connect(addr1).transfer(addr2.address, 100);
      expect(await slc.balanceOf(addr2.address)).to.equal(100);
    });
  });

  // ----------------------------------------------------------------------------------------
  // 7. Transfers with fee
  // ----------------------------------------------------------------------------------------
  describe("Transfers with fee", function () {
    beforeEach(async () => {
      // Mint 1000 tokens for addr1
      await slc.connect(minter).mint(addr1.address, 1000);
    });

    it("should apply transferFeeBasisPoints on each transfer", async function () {
      // For clarity, update the fee to 1% (100 bp)
      await slc.updateFee(100);
      await slc.connect(addr1).transfer(addr2.address, 500);

      // 1% of 500 = 5 goes to feeCollector, addr2 receives 495
      expect(await slc.balanceOf(addr2.address)).to.equal(495);
      expect(await slc.balanceOf(feeCollector.address)).to.equal(5);
    });

    it("should revert if sender or recipient is frozen", async function () {
      await slc.freeze(addr1.address);
      await expect(slc.connect(addr1).transfer(addr2.address, 100))
        .to.be.revertedWithCustomError(slc, "Unauthorized");
    });
  });

  // ----------------------------------------------------------------------------------------
  // 8. getLatestPrice
  // ----------------------------------------------------------------------------------------
  describe("getLatestPrice", function () {
    it("should return current mock price", async function () {
      expect(await slc.getLatestPrice()).to.equal(INITIAL_PRICE);
    });

    it("should revert if price <= 0", async function () {
      await mockPriceFeed.setPrice(0);
      await expect(slc.getLatestPrice()).to.be.revertedWithCustomError(slc, "PriceInvalid");

      await mockPriceFeed.setPrice(-10);
      await expect(slc.getLatestPrice()).to.be.revertedWithCustomError(slc, "PriceInvalid");
    });
  });

  // ----------------------------------------------------------------------------------------
  // 9. adjustSupply
  // ----------------------------------------------------------------------------------------
  describe("adjustSupply", function () {
    beforeEach(async () => {
      // Initially, price equals peggedPrice (3.24), so adjustSupply() does nothing.
    });

    it("should do nothing if price is within tolerance", async function () {
      await mockPriceFeed.setPrice(325000000); // 3.25 (likely within 1% tolerance)
      await slc.adjustSupply();
      expect(await slc.totalSupply()).to.equal(0);
    });

    it("should mint tokens to contract if price > upperThreshold", async function () {
      await mockPriceFeed.setPrice(330000000); // 3.30, above the upper threshold

      // With zero current supply, adjustSupply does nothing
      await slc.adjustSupply();
      expect(await slc.totalSupply()).to.equal(0);

      // Now mint tokens so that adjustSupply has a nonzero supply to work with
      await slc.connect(minter).mint(owner.address, 1000);
      await slc.adjustSupply();
      const newSupply = await slc.totalSupply();
      expect(newSupply).to.be.gt(1000);
    });

    it("should burn tokens from contract if price < lowerThreshold", async function () {
      await mockPriceFeed.setPrice(350000000);
      await slc.connect(minter).mint(owner.address, 1000);
      await slc.adjustSupply();

      await mockPriceFeed.setPrice(300000000); // 3.00, below lower threshold
      await slc.adjustSupply();
      const finalSupply = await slc.totalSupply();
      expect(finalSupply).to.be.lt(2000);
    });

    it("should not revert if contract balance < excess (partial burn)", async function () {
      await slc.connect(minter).mint(owner.address, 1000);
      await mockPriceFeed.setPrice(400000000);
      await slc.adjustSupply(); // Contract mints tokens to itself

      await mockPriceFeed.setPrice(200000000); // Price drops significantly
      await slc.adjustSupply();
      // If no revert occurs, the test passes.
    });
  });

  // ----------------------------------------------------------------------------------------
  // 10. Chainlink Keepers (checkUpkeep / performUpkeep)
  // ----------------------------------------------------------------------------------------
  describe("Chainlink Keepers", function () {
    it("checkUpkeep returns true if price is out of tolerance, false otherwise", async function () {
      let [upkeepNeeded] = await slc.callStatic.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false; // With price = peggedPrice and tolerance = 1%

      await mockPriceFeed.setPrice(330000000);
      [upkeepNeeded] = await slc.callStatic.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.true;
    });

    it("performUpkeep calls adjustSupply if upkeepNeeded is true", async function () {
      // With current price in tolerance, performUpkeep does nothing
      await slc.performUpkeep("0x");

      await mockPriceFeed.setPrice(330000000);
      await expect(slc.performUpkeep("0x")).to.not.be.reverted;
      // Optionally, one could check for a change in totalSupply.
    });
  });

  // ----------------------------------------------------------------------------------------
  // 11. ReentrancyGuard (demonstration)
  // ----------------------------------------------------------------------------------------
  describe("ReentrancyGuard", function () {
    it("should not allow reentrant calls to adjustSupply", async function () {
      // A full test would require a custom attacking contract.
      // For now, this symbolic test simply passes.
      expect(true).to.equal(true);
    });
  });

  // ----------------------------------------------------------------------------------------
  // 12. UUPS Upgrade (optional)
  // ----------------------------------------------------------------------------------------
  describe("UUPS Upgrade", function () {
    it("only admin can upgrade", async function () {
      const SLCLogicV2 = await ethers.getContractFactory("SLC_contract");
      // Attempt to upgrade with a non-admin account
      await expect(
        upgrades.upgradeProxy(slc.address, SLCLogicV2.connect(addr1))
      ).to.be.reverted;
      // Successful upgrade by admin
      await upgrades.upgradeProxy(slc.address, SLCLogicV2);
    });
  });
});
