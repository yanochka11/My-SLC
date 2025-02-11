const hre = require("hardhat");

async function main() {
  console.log("Starting getImplementation script...");

  //  proxy address for the Tether USD token contract
  // const proxyAddress = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";
  const proxyAddress = "0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C";
  
  // ERC1967 implementation slot for UUPS/Transparent proxies:
  const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  
  // Read the raw value from the proxy's implementation slot
  const rawValue = await hre.ethers.provider.getStorageAt(proxyAddress, IMPLEMENTATION_SLOT);
  console.log("Raw storage value:", rawValue);
  
  // If the value is all zeros, then the slot is empty
  if (rawValue === "0x" + "0".repeat(64)) {
    console.log("The implementation slot is empty.");
    return;
  }
  
  // The implementation address is stored in the lower 20 bytes (40 hex characters) of the 32-byte word.
  // Extract the last 40 characters:
  const implAddressExtracted = "0x" + rawValue.slice(-40);
  
  // Convert to a checksummed address 
  let implementationAddress;
  try {
    implementationAddress = hre.ethers.utils.getAddress(implAddressExtracted);
  } catch (error) {
    console.error("Error: Invalid implementation address", error);
    return;
  }
  
  console.log("Implementation Address:", implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error in script:", error);
    process.exit(1);
  });
