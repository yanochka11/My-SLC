// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title AY Arabic Proxy Contract
/// @notice Прокси-контракт для AY Arabic Stablecoin. Все вызовы делегируются в реализацию.
contract AYArabicProxy {
    // Слоты хранения для адреса реализации и администратора
    bytes32 private constant IMPLEMENTATION_SLOT = keccak256("ayarabic.proxy.implementation");
    bytes32 private constant ADMIN_SLOT = keccak256("ayarabic.proxy.admin");

    /// @notice Конструктор задаёт адреса реализации и администратора, а также выполняет инициализацию (если переданы данные).
    /// @param _implementation Адрес контракта-реализации.
    /// @param _admin Адрес администратора.
    /// @param _data Данные инициализации для делегированного вызова.
    constructor(address _implementation, address _admin, bytes memory _data) {
        require(_implementation != address(0), "Invalid implementation address");
        require(_admin != address(0), "Invalid admin address");
        assembly {
            sstore(IMPLEMENTATION_SLOT, _implementation)
            sstore(ADMIN_SLOT, _admin)
        }
        if (_data.length > 0) {
            (bool success, ) = _implementation.delegatecall(_data);
            require(success, "Initialization failed");
        }
    }
    
    /// @notice Fallback функция для делегирования вызовов реализации.
    fallback() external payable {
        _delegate(_implementation());
    }
    
    /// @notice Функция для получения эфира.
    receive() external payable {
        _delegate(_implementation());
    }
    
    /// @notice Внутренняя функция для получения адреса реализации.
    function _implementation() internal view returns (address impl) {
        assembly {
            impl := sload(IMPLEMENTATION_SLOT)
        }
    }
    
    /// @notice Делегирует вызов к адресу реализации.
    /// @param impl Адрес реализации.
    function _delegate(address impl) internal {
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
