// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title AY_ProxyAdmin
 * @notice Admin contract to manage proxy upgrades for AY Arabic.
 */
contract AY_ProxyAdmin {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "AY_ProxyAdmin: Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function upgrade(address proxyAddress, address newImplementation) external onlyOwner {
        (bool success, ) = proxyAddress.call(abi.encodeWithSignature("upgradeTo(address)", newImplementation));
        require(success, "Upgrade failed");
    }
}
