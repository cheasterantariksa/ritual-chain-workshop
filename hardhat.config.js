import "dotenv/config";

export default {
  solidity: "0.8.19",
  plugins: [
    { id: "hardhat-viem" }
  ],
  paths: {
    sources: "./contracts",
  },
  networks: {
    ritual: {
      type: "http",
      url: process.env.RPC_URL || "https://rpc.ritualfoundation.org",
      chainId: 1979,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};