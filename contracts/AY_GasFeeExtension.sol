// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./AY_Modifiers.sol";
import "./AY_Configuration.sol";

/**
 * @title AY_GasFeeExtension
 * @notice Provides functions to debit and credit a fixed gas fee (0.1 dinar per transaction)
 * for AY Arabic. The fee parameters are read from the external AY_Configuration contract.
 */
abstract contract AY_GasFeeExtension is AY_Modifiers {
    // Reference to the configuration contract
    AY_Configuration public config;

    /**
     * @notice Sets the configuration contract address.
     * @param _config Address of the AY_Configuration contract.
     * @dev Callable only by an authorized fee caller.
     */
    function setConfiguration(address _config) external onlyAuthorizedFeeCaller {
        require(_config != address(0), "Invalid config address");
        config = AY_Configuration(_config);
    }

    /**
     * @notice Debits the fixed gas fee from a user's balance.
     * @param from The address to debit.
     * @param feeValue The fee value; must equal config.fixedGasFee.
     */
    function debitGasFees(address from, uint256 feeValue) external virtual onlyAuthorizedFeeCaller {
        require(feeValue == config.fixedGasFee(), "Invalid fee value");
        _transfer(from, config.gasFeeCollector(), config.fixedGasFee());
    }

    /**
     * @notice Credits and distributes the gas fee.
     * @param refundRecipient Recipient for refund.
     * @param tipRecipient Recipient for tip.
     * @param baseFeeRecipient Recipient for base fee.
     * @param refundAmount Amount for refund.
     * @param tipAmount Amount for tip.
     * @param baseFeeAmount Amount for base fee.
     */
    function creditGasFees(
        address refundRecipient,
        address tipRecipient,
        address baseFeeRecipient,
        uint256 refundAmount,
        uint256 tipAmount,
        uint256 baseFeeAmount
    ) external virtual onlyAuthorizedFeeCaller {
        require(refundAmount + tipAmount + baseFeeAmount == config.fixedGasFee(), "Invalid distribution sum");

        if (tipRecipient != address(0)) {
            _transfer(config.gasFeeCollector(), tipRecipient, tipAmount);
        }
        if (baseFeeRecipient != address(0)) {
            _transfer(config.gasFeeCollector(), baseFeeRecipient, baseFeeAmount);
        }
        if (refundAmount > 0 && refundRecipient != address(0)) {
            _transfer(config.gasFeeCollector(), refundRecipient, refundAmount);
        }
    }

    // The _transfer function must be implemented by the inheriting ERC20 contract.
    function _transfer(address sender, address recipient, uint256 amount) internal virtual;
}
