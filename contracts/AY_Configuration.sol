// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title AY_Configuration
 * @notice Holds all mutable configuration parameters for the AY Arabic system.
 * Allows the configuration owner (main admin) to update core role addresses,
 * fee settings, and commission splits.
 *
 * In this implementation, the configuration owner is fixed to:
 * 0xf5304f3714760beBCe7a8eE4dcE4Be187934cf16
 *
 * The gas fee collector address is fixed to:
 * 0x5F3F9e8723ED085a405f872D65D471A6262d0fB4
 */
contract AY_Configuration {
    // Core role addresses (can be updated by the configuration owner)
    address public brokerAddress;
    address public validatorsAddress;
    address public exchangeAddress;

    // Fee configuration variables
    // Fixed gas fee in token units (default 0.1 dinar with 18 decimals: 1e17)
    uint256 public fixedGasFee;
    // Address that collects gas fee funds; preset to the specified address
    address public gasFeeCollector;
    // Fee wrapper address authorized to perform fee operations
    address public feeWrapper;

    // Commission splits in basis points (total must equal 10000)
    uint256 public refundPercentage;  // For refunds
    uint256 public tipPercentage;       // For tips
    uint256 public baseFeePercentage;   // For base fee

    // Configuration owner (administrator) – fixed to the main admin address
    address public configOwner;

    event ConfigUpdated(string key, bytes newValue);

    modifier onlyConfigOwner() {
        require(msg.sender == configOwner, "AY_Configuration: Not config owner");
        _;
    }

    constructor() {
        // Задаём владельца конфигурации фиксированным значением:
        configOwner = 0xf5304f3714760beBCe7a8eE4dcE4Be187934cf16;
        
        // Задаём фиксированную газовую комиссию: 0.1 динар (с 18 десятичными)
        fixedGasFee = 1e17;
        
        // Задаём фиксированный адрес для сбора газовых комиссий
        gasFeeCollector = 0x5F3F9e8723ED085a405f872D65D471A6262d0fB4;
        
        // Изначально feeWrapper не задан (нулевой адрес)
        feeWrapper = address(0);

        // Стандартное распределение комиссий: 50% возврат, 30% чаевые, 20% базовая комиссия
        refundPercentage = 5000;
        tipPercentage = 3000;
        baseFeePercentage = 2000;

        // Инициализируем адреса основных ролей нулевыми значениями (будут обновлены позже)
        brokerAddress = address(0);
        validatorsAddress = address(0);
        exchangeAddress = address(0);
    }

    /**
     * @notice Sets the broker address.
     * @param _broker New broker address.
     */
    function setBrokerAddress(address _broker) external onlyConfigOwner {
        require(_broker != address(0), "Invalid broker address");
        brokerAddress = _broker;
        emit ConfigUpdated("brokerAddress", abi.encode(_broker));
    }

    /**
     * @notice Sets the validators address.
     * @param _validators New validators address.
     */
    function setValidatorsAddress(address _validators) external onlyConfigOwner {
        require(_validators != address(0), "Invalid validators address");
        validatorsAddress = _validators;
        emit ConfigUpdated("validatorsAddress", abi.encode(_validators));
    }

    /**
     * @notice Sets the exchange address.
     * @param _exchange New exchange address.
     */
    function setExchangeAddress(address _exchange) external onlyConfigOwner {
        require(_exchange != address(0), "Invalid exchange address");
        exchangeAddress = _exchange;
        emit ConfigUpdated("exchangeAddress", abi.encode(_exchange));
    }

    /**
     * @notice Sets the fixed gas fee.
     * @param _fixedGasFee New fixed gas fee value.
     */
    function setFixedGasFee(uint256 _fixedGasFee) external onlyConfigOwner {
        require(_fixedGasFee > 0, "Fixed gas fee must be > 0");
        fixedGasFee = _fixedGasFee;
        emit ConfigUpdated("fixedGasFee", abi.encode(_fixedGasFee));
    }

    /**
     * @notice Sets the gas fee collector address.
     * @param _collector New collector address.
     */
    function setGasFeeCollector(address _collector) external onlyConfigOwner {
        require(_collector != address(0), "Invalid collector address");
        gasFeeCollector = _collector;
        emit ConfigUpdated("gasFeeCollector", abi.encode(_collector));
    }

    /**
     * @notice Sets the fee wrapper address.
     * @param _feeWrapper New fee wrapper address.
     */
    function setFeeWrapper(address _feeWrapper) external onlyConfigOwner {
        require(_feeWrapper != address(0), "Invalid fee wrapper address");
        feeWrapper = _feeWrapper;
        emit ConfigUpdated("feeWrapper", abi.encode(_feeWrapper));
    }

    /**
     * @notice Sets the commission splits in basis points.
     * @param _refundPercentage Percentage for refunds.
     * @param _tipPercentage Percentage for tips.
     * @param _baseFeePercentage Percentage for base fee.
     */
    function setCommissionSplits(uint256 _refundPercentage, uint256 _tipPercentage, uint256 _baseFeePercentage) external onlyConfigOwner {
        require(_refundPercentage + _tipPercentage + _baseFeePercentage == 10000, "Total must equal 10000 bp");
        refundPercentage = _refundPercentage;
        tipPercentage = _tipPercentage;
        baseFeePercentage = _baseFeePercentage;
        emit ConfigUpdated("commissionSplits", abi.encode(_refundPercentage, _tipPercentage, _baseFeePercentage));
    }

    /**
     * @notice Transfers ownership of the configuration contract to a new owner.
     * @param newOwner New configuration owner address.
     */
    function transferConfigOwnership(address newOwner) external onlyConfigOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        configOwner = newOwner;
        emit ConfigUpdated("configOwner", abi.encode(newOwner));
    }
}
