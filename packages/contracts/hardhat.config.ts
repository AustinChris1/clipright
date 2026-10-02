import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, type HardhatUserConfig } from "hardhat/config";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {}

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViem],
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 1000 }, evmVersion: "prague" },
  },
  networks: {
    localhost: { type: "http", chainType: "l1", url: "http://127.0.0.1:8545" },
    monadTestnet: {
      type: "http",
      chainType: "l1",
      chainId: 10143,
      url: "https://testnet-rpc.monad.xyz",
      accounts: [configVariable("RELAYER_KEY")],
    },
  },
};

export default config;
