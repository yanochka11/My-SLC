// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title AY_EventDefinitions
 * @notice Declares events used in AY Arabic contracts.
 */
abstract contract AY_EventDefinitions {
    event TransferComment(string comment);
    event BrokerUpdated(address newBroker);
    event ValidatorsUpdated(address newValidators);
    event ExchangeUpdated(address newExchange);
    event FeeWrapperUpdated(address newFeeWrapper);
}
