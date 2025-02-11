// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title AY_Modifiers
 * @notice Contains common modifiers for AY Arabic.
 */
abstract contract AY_Modifiers {
    // Authorized fee wrapper address for fee operations.
    address public feeWrapper;

    modifier onlyAuthorizedFeeCaller() {
        require(msg.sender == feeWrapper, "AY_Modifiers: Not authorized for fee operations");
        _;
    }

    /**
     * @notice Internal setter for feeWrapper.
     * @param _wrapper New fee wrapper address.
     */
    function _setFeeWrapper(address _wrapper) internal {
        feeWrapper = _wrapper;
    }
}
