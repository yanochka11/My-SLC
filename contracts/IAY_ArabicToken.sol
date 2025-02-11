// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/**
 * @title IAY_ArabicToken
 * @notice Interface for the AY Arabic token.
 */
interface IAY_ArabicToken is IERC20Upgradeable {
    function initialize(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address broker,
        address validators,
        address exchange
    ) external;

    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;

    function updateBroker(address newBroker) external;
    function updateValidators(address newValidators) external;
    function updateExchange(address newExchange) external;
}
