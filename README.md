contracts/
├── AY_ArabicTokenV2.sol        // (1) Main implementation contract (UUPS upgradeable)
├── IAY_ArabicToken.sol         // (2) Interface for AY Arabic token
├── AY_CalledByVm.sol           // (3) Stub for VM-only call checks
├── AY_ERC20Upgradeable.sol     // (4) ERC20Upgradeable wrapper
├── AY_ERC20PermitUpgradeable.sol  // (5) ERC20PermitUpgradeable wrapper
├── AY_GasFeeExtension.sol      // (6) Fixed gas fee management (reads from configuration)
├── AY_Initializable.sol        // (7) Simplified initializable base
├── AY_Modifiers.sol            // (8) Common modifiers (e.g. fee wrapper authorization)
├── AY_EventDefinitions.sol     // (9) Event declarations
├── AY_Configuration.sol        // (10) Central configuration (addresses, fees, commission splits)
├── AY_ProxyAdmin.sol           // (11) Proxy administration contract
├── AY_Documentation.sol        // (12) Internal documentation (optional)
└── AY_Version.sol              // (13) Contract version


|-test/AYArabic.test.js
|-deploy/deploy.js
|-Proxy/AYArabicProxy.sol
