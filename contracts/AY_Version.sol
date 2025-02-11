// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title AY_Version
 * @notice Returns the version of the AY Arabic contract.
 */
contract AY_Version {
    function version() external pure returns (string memory) {
        return "AY Arabic v1.0.0";
    }
}
