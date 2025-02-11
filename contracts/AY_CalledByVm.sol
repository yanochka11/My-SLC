// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

/**
 * @title AY_CalledByVm
 * @notice Provides a modifier to restrict functions to be called only by an authorized system.
 * This is a stub for demonstration purposes.
 */
abstract contract AY_CalledByVm is ContextUpgradeable {
    modifier onlyVm() {
        // In production, add a check such as:
        // require(msg.sender == vmAddress, "Not called by VM");
        _;
    }
    
    // Override _disableInitializers from Initializable (inherited via ContextUpgradeable)
    function _disableInitializers() internal virtual override {
        // You can call the parent implementation if needed.
        super._disableInitializers();
    }
}
