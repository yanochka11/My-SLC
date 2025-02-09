// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// =============== Imports ===============
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

// Chainlink imports
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol"; 
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

// =============== Custom Errors (for bytecode efficiency) ===============
error Unauthorized();
error ZeroAddress();
error PriceInvalid();

/**
 * @title SLC_contract
 * @dev Upgradeable (UUPS) stablecoin contract pegged to a dinar value.
 *      Uses Chainlink for price feeds and Automation (Keepers) for automatic supply adjustment.
 */
contract SLC_contract is 
    ERC20Upgradeable, 
    ERC20PermitUpgradeable, 
    PausableUpgradeable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable, 
    ReentrancyGuardUpgradeable,
    AutomationCompatible // Inherit from the AutomationCompatible base contract
{
    // ============ Access Roles ============
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    // ============ Fee Parameters ============
    uint256 public transferFeeBasisPoints; // Fee in basis points (1 bp = 0.01%)
    address public feeCollector;           // Address that collects fees

    // ============ Blacklist Mechanism ============
    mapping(address => bool) public frozen;

    // ============ Stability Mechanism Data ============
    AggregatorV3Interface public priceFeed; // Chainlink Price Feed Oracle
    uint256 public peggedPrice;               // Target price (e.g. 3.24 USD with 8 decimals = 324000000)
    uint256 public tolerance;                 // Allowed deviation in basis points (e.g. 100 = 1%)

    // ============ Events ============
    event FeeUpdated(uint256 newFeeBasisPoints);
    event FeeCollectorUpdated(address newCollector);
    event AccountFrozen(address indexed account);
    event AccountUnfrozen(address indexed account);
    event SupplyAdjusted(uint256 newTotalSupply);
    event PeggedPriceUpdated(uint256 newPeggedPrice);
    event ToleranceUpdated(uint256 newTolerance);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    // =============================================
    // ========== Initialization Function ==========
    function initialize(address _priceFeed, address _feeCollector) public initializer {
        if (_priceFeed == address(0) || _feeCollector == address(0)) revert ZeroAddress();

        __ERC20_init("Stable Lori Coin", "SLC");
        __ERC20Permit_init("Stable Lori Coin");
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        // Grant roles using _grantRole (instead of deprecated _setupRole)
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);

        priceFeed = AggregatorV3Interface(_priceFeed);
        feeCollector = _feeCollector;
        transferFeeBasisPoints = 1; // 1 bp = 0.01%

        peggedPrice = 324000000; // Example: 3.24 USD with 8 decimals
        tolerance = 100;         // 1% tolerance (100 bp)
    }

    // =====================================================
    // ============ Blacklist Functions ====================
    // =====================================================
    function freeze(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        frozen[account] = true;
        emit AccountFrozen(account);
    }

    function unfreeze(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        frozen[account] = false;
        emit AccountUnfrozen(account);
    }

    // =====================================================
    // ============ Fee and Fee Collector Updates ==========
    // =====================================================
    function updateFee(uint256 newFeeBasisPoints) external onlyRole(DEFAULT_ADMIN_ROLE) {
        transferFeeBasisPoints = newFeeBasisPoints;
        emit FeeUpdated(newFeeBasisPoints);
    }

    function updateFeeCollector(address newCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newCollector == address(0)) revert ZeroAddress();
        feeCollector = newCollector;
        emit FeeCollectorUpdated(newCollector);
    }

    // =====================================================
    // ============ Stability Parameter Updates ============
    // =====================================================
    function updatePeggedPrice(uint256 newPeggedPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newPeggedPrice == 0) revert ZeroAddress();
        peggedPrice = newPeggedPrice;
        emit PeggedPriceUpdated(newPeggedPrice);
    }

    function updateTolerance(uint256 newTolerance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tolerance = newTolerance;
        emit ToleranceUpdated(newTolerance);
    }

    function updatePriceFeed(address newFeed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeed == address(0)) revert ZeroAddress();
        priceFeed = AggregatorV3Interface(newFeed);
    }

    // =====================================================
    // ============ Overridden _transfer Function ==========
    function _transfer(address sender, address recipient, uint256 amount) internal override {
        if (frozen[sender] || frozen[recipient]) revert Unauthorized();

        uint256 fee = (amount * transferFeeBasisPoints) / 10000;
        uint256 amountAfterFee = amount - fee;

        if (fee > 0) {
            super._transfer(sender, feeCollector, fee);
        }
        super._transfer(sender, recipient, amountAfterFee);
    }

    // =====================================================
    // ============= Pausable Token Transfer ===============
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable)
        whenNotPaused
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    // =====================================================
    // ============== Mint and Burn Functions ==============
    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
    {
        _mint(to, amount);
    }

    function burn(uint256 amount)
        external
        onlyRole(BURNER_ROLE)
        whenNotPaused
        nonReentrant
    {
        _burn(msg.sender, amount);
    }

    // =====================================================
    // ============== Get Price from Oracle ================
    function getLatestPrice() public view returns (uint256) {
        (, int256 price,,,) = priceFeed.latestRoundData();
        if (price <= 0) revert PriceInvalid();
        return uint256(price);
    }

    // =====================================================
    // ============= Supply Adjustment Function ============
    function adjustSupply() public whenNotPaused nonReentrant {
        uint256 currentPrice = getLatestPrice();
        uint256 upperThreshold = (peggedPrice * (10000 + tolerance)) / 10000;
        uint256 lowerThreshold = (peggedPrice * (10000 - tolerance)) / 10000;

        uint256 currentSupply = totalSupply();

        if (currentPrice > upperThreshold) {
            uint256 targetSupply = (currentSupply * currentPrice) / peggedPrice;
            if (targetSupply > currentSupply) {
                uint256 deficit = targetSupply - currentSupply;
                _mint(address(this), deficit);
            }
        } else if (currentPrice < lowerThreshold) {
            uint256 targetSupply = (currentSupply * currentPrice) / peggedPrice;
            if (targetSupply < currentSupply) {
                uint256 excess = currentSupply - targetSupply;
                uint256 contractBalance = balanceOf(address(this));
                if (contractBalance > 0) {
                    uint256 burnAmount = (contractBalance >= excess) ? excess : contractBalance;
                    _burn(address(this), burnAmount);
                }
            }
        }

        emit SupplyAdjusted(totalSupply());
    }

    // =====================================================
    // ============= Automation (Keepers) Functions =========
    // Note: checkUpkeep is not marked as view.
    function checkUpkeep(bytes calldata)
        external
        override
        returns (bool upkeepNeeded, bytes memory)
    {
        uint256 currentPrice = getLatestPrice();
        uint256 upperThreshold = (peggedPrice * (10000 + tolerance)) / 10000;
        uint256 lowerThreshold = (peggedPrice * (10000 - tolerance)) / 10000;

        upkeepNeeded = (currentPrice > upperThreshold || currentPrice < lowerThreshold);
        return (upkeepNeeded, "");
    }

    function performUpkeep(bytes calldata) external override {
        adjustSupply();
    }

    // =====================================================
    // ============== UUPS Upgradeability ==================
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    // =====================================================
    // =============== Pause and Unpause ===================
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
