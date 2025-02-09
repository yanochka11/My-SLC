// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockPriceFeed is AggregatorV3Interface {
    int256 private _price;
    
    constructor(int256 initialPrice) {
        _price = initialPrice;
    }
    
    function setPrice(int256 newPrice) external {
        _price = newPrice;
    }
    
    // Implementation of latestRoundData() from the AggregatorV3Interface.
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (0, _price, 0, 0, 0);
    }
    
    // Dummy implementations for the other interface functions.
    function decimals() external view override returns (uint8) {
        return 8;
    }
    
    function description() external view override returns (string memory) {
        return "Mock Price Feed";
    }
    
    function version() external view override returns (uint256) {
        return 1;
    }
}
