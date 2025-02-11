// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

/**
 * @title AY_ERC20Upgradeable
 * @notice A thin wrapper over OpenZeppelin's ERC20Upgradeable for AY Arabic.
 */
abstract contract AY_ERC20Upgradeable is ERC20Upgradeable {
    /**
     * @notice Initializes the ERC20 token.
     * @param name_ The token name.
     * @param symbol_ The token symbol.
     */
    function __AY_ERC20_init(string memory name_, string memory symbol_) internal initializer {
        __ERC20_init(name_, symbol_);
    }
}
