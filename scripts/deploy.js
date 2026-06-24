import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createRequire } from "module";
import "dotenv/config";

const require = createRequire(import.meta.url);
const artifact = require("../artifacts/contracts/PrivacyBounty.sol/PrivacyBounty.json");

const ritualChain = {
  id: 1979,
  name: "CratD2C Testnet",
  nativeCurrency: { name: "CRAT", symbol: "CRAT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.ritualfoundation.org"] } },
};

const account = privateKeyToAccount(process.env.PRIVATE_KEY);

const walletClient = createWalletClient({
  account,
  chain: ritualChain,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: ritualChain,
  transport: http(),
});

async function main() {
  console.log("Deploying PrivacyBounty...");
  console.log("Deployer:", account.address);

  // Get nonce terbaru
  const nonce = await publicClient.getTransactionCount({
    address: account.address,
  });
  console.log("Nonce:", nonce);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [],
    nonce: nonce,
  });

  console.log("TX hash:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("✅ Deployed to:", receipt.contractAddress);
}

main().catch(console.error);