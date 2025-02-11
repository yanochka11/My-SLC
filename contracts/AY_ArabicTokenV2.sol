// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

// Import core OpenZeppelin modules
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// Import custom implementations
import "./AY_ERC20PermitUpgradeable.sol";
import "./IAY_ArabicToken.sol";
import "./AY_CalledByVm.sol";
import "./AY_GasFeeExtension.sol";
import "./AY_EventDefinitions.sol";

contract AY_ArabicTokenV2 is 
    AY_ERC20PermitUpgradeable,   // Provides ERC20 and permit functionality.
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    AY_GasFeeExtension,          // Declares an abstract _transfer() function.
    AY_EventDefinitions,
    AY_CalledByVm,
    IAY_ArabicToken             // For mint() and burn() interface functions.
{
    // Role definitions
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant BLOCKLIST_ROLE = keccak256("BLOCKLIST_ROLE");
    bytes32 public constant UPGRADE_ROLE = keccak256("UPGRADE_ROLE");
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // Mapping for blocked accounts
    mapping(address => bool) private _blocklist;

    /**
     * @dev Authorizes contract upgrades.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADE_ROLE) {}

    /**
     * @notice Initializes the AY Arabic token.
     */
    function initialize(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        address _broker,
        address _validators,
        address _exchange
    ) external initializer {
        __AY_ERC20Permit_init(_name, _symbol);
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        // (ContextUpgradeable is already initialized by __AY_ERC20Permit_init if needed)

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(MINTER_ROLE, _broker);
        _grantRole(MINTER_ROLE, _validators);
        _grantRole(BURNER_ROLE, _broker);
        _grantRole(BURNER_ROLE, _exchange);
        _grantRole(UPGRADE_ROLE, _msgSender());
        _grantRole(PAUSE_ROLE, _msgSender());

        _mint(_msgSender(), _initialSupply);
    }

    // --- Token Functions (from IAY_ArabicToken) ---
    function mint(address to, uint256 amount) external override onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit TransferComment("Mint executed");
    }

    function burn(uint256 amount) external override onlyRole(BURNER_ROLE) {
        _burn(_msgSender(), amount);
        emit TransferComment("Burn executed");
    }

    // --- Administrative Functions ---
    function updateBroker(address _newBroker) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, _newBroker);
        _grantRole(BURNER_ROLE, _newBroker);
        emit BrokerUpdated(_newBroker);
    }

    function updateValidators(address _newValidators) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, _newValidators);
        emit ValidatorsUpdated(_newValidators);
    }

    function updateExchange(address _newExchange) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(BURNER_ROLE, _newExchange);
        emit ExchangeUpdated(_newExchange);
    }

    // --- Blocklist Management ---
    function blockAccount(address account) external onlyRole(BLOCKLIST_ROLE) {
        require(!_blocklist[account], "AY_ArabicTokenV2: Account already blocked");
        _blocklist[account] = true;
        emit TransferComment("Account blocked");
    }

    function unblockAccount(address account) external onlyRole(BLOCKLIST_ROLE) {
        require(_blocklist[account], "AY_ArabicTokenV2: Account not blocked");
        _blocklist[account] = false;
        emit TransferComment("Account unblocked");
    }

    function isBlocked(address account) public view returns (bool) {
        return _blocklist[account];
    }

    // --- Pausable Functions ---
    function pause() external onlyRole(PAUSE_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSE_ROLE) {
        _unpause();
    }

    // --- Override _beforeTokenTransfer ---
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        require(!paused(), "AY_ArabicTokenV2: Transfers are paused");
        if (from != address(0)) {
            require(!_blocklist[from], "AY_ArabicTokenV2: Sender is blocked");
        }
        super._beforeTokenTransfer(from, to, amount);
    }

    // --- Resolve diamond inheritance for _disableInitializers ---
    // We override from AY_CalledByVm and Initializable (which is inherited via ContextUpgradeable)
    function _disableInitializers() internal override(AY_CalledByVm, Initializable) {
        super._disableInitializers();
    }

    // --- Resolve diamond inheritance for _msgSender ---
    // Override from ContextUpgradeable only, as AY_CalledByVm does not provide its own _msgSender.
    function _msgSender() internal view virtual override(ContextUpgradeable) returns (address) {
        return super._msgSender();
    }

    // --- Resolve diamond inheritance for _transfer ---
    // Both ERC20 (via AY_ERC20PermitUpgradeable) and AY_GasFeeExtension define _transfer.
    function _transfer(address sender, address recipient, uint256 amount)
        internal
        override(ERC20Upgradeable, AY_GasFeeExtension)
    {
        super._transfer(sender, recipient, amount);
    }
}
