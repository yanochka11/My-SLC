// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./AY_ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";

/**
 * @title AY_ERC20PermitUpgradeable
 * @notice ERC20 token with permit functionality for AY Arabic.
 */
abstract contract AY_ERC20PermitUpgradeable is AY_ERC20Upgradeable, ERC20PermitUpgradeable {
    /**
     * @notice Initializes the ERC20 and Permit logic.
     * @param name_ Token name.
     * @param symbol_ Token symbol.
     */
    function __AY_ERC20Permit_init(string memory name_, string memory symbol_) internal initializer {
        __AY_ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
    }
}
