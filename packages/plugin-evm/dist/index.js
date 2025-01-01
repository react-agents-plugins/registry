// src/actions/bridge.ts
import {
  createConfig,
  executeRoute,
  getRoutes
} from "@lifi/sdk";

// src/providers/wallet.ts
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as viemChains from "viem/chains";
var WalletProvider = class _WalletProvider {
  currentChain = "mainnet";
  chains = { mainnet: viemChains.mainnet };
  account;
  constructor(privateKey, chains) {
    this.setAccount(privateKey);
    this.setChains(chains);
    if (chains && Object.keys(chains).length > 0) {
      this.setCurrentChain(Object.keys(chains)[0]);
    }
  }
  getAddress() {
    return this.account.address;
  }
  getCurrentChain() {
    return this.chains[this.currentChain];
  }
  getPublicClient(chainName) {
    const transport = this.createHttpTransport(chainName);
    const publicClient = createPublicClient({
      chain: this.chains[chainName],
      transport
    });
    return publicClient;
  }
  getWalletClient(chainName) {
    const transport = this.createHttpTransport(chainName);
    const walletClient = createWalletClient({
      chain: this.chains[chainName],
      transport,
      account: this.account
    });
    return walletClient;
  }
  getChainConfigs(chainName) {
    const chain = viemChains[chainName];
    if (!chain?.id) {
      throw new Error("Invalid chain name");
    }
    return chain;
  }
  async getWalletBalance() {
    try {
      const client = this.getPublicClient(this.currentChain);
      const balance = await client.getBalance({
        address: this.account.address
      });
      return formatUnits(balance, 18);
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      return null;
    }
  }
  async getWalletBalanceForChain(chainName) {
    try {
      const client = this.getPublicClient(chainName);
      const balance = await client.getBalance({
        address: this.account.address
      });
      return formatUnits(balance, 18);
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      return null;
    }
  }
  addChain(chain) {
    this.setChains(chain);
  }
  switchChain(chainName, customRpcUrl) {
    if (!this.chains[chainName]) {
      const chain = _WalletProvider.genChainFromName(
        chainName,
        customRpcUrl
      );
      this.addChain({ [chainName]: chain });
    }
    this.setCurrentChain(chainName);
  }
  setAccount = (pk) => {
    this.account = privateKeyToAccount(pk);
  };
  setChains = (chains) => {
    if (!chains) {
      return;
    }
    Object.keys(chains).forEach((chain) => {
      this.chains[chain] = chains[chain];
    });
  };
  setCurrentChain = (chain) => {
    this.currentChain = chain;
  };
  createHttpTransport = (chainName) => {
    const chain = this.chains[chainName];
    if (chain.rpcUrls.custom) {
      return http(chain.rpcUrls.custom.http[0]);
    }
    return http(chain.rpcUrls.default.http[0]);
  };
  static genChainFromName(chainName, customRpcUrl) {
    const baseChain = viemChains[chainName];
    if (!baseChain?.id) {
      throw new Error("Invalid chain name");
    }
    const viemChain = customRpcUrl ? {
      ...baseChain,
      rpcUrls: {
        ...baseChain.rpcUrls,
        custom: {
          http: [customRpcUrl]
        }
      }
    } : baseChain;
    return viemChain;
  }
};
var genChainsFromRuntime = (runtime) => {
  const chainNames = runtime.character.settings.chains?.evm || [];
  const chains = {};
  chainNames.forEach((chainName) => {
    const rpcUrl = runtime.getSetting(
      "ETHEREUM_PROVIDER_" + chainName.toUpperCase()
    );
    const chain = WalletProvider.genChainFromName(chainName, rpcUrl);
    chains[chainName] = chain;
  });
  const mainnet_rpcurl = runtime.getSetting("EVM_PROVIDER_URL");
  if (mainnet_rpcurl) {
    const chain = WalletProvider.genChainFromName(
      "mainnet",
      mainnet_rpcurl
    );
    chains["mainnet"] = chain;
  }
  return chains;
};
var initWalletProvider = (runtime) => {
  const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
  if (!privateKey) {
    throw new Error("EVM_PRIVATE_KEY is missing");
  }
  const chains = genChainsFromRuntime(runtime);
  return new WalletProvider(privateKey, chains);
};
var evmWalletProvider = {
  async get(runtime, message, state) {
    try {
      const walletProvider = initWalletProvider(runtime);
      const address = walletProvider.getAddress();
      const balance = await walletProvider.getWalletBalance();
      const chain = walletProvider.getCurrentChain();
      return `EVM Wallet Address: ${address}
Balance: ${balance} ${chain.nativeCurrency.symbol}
Chain ID: ${chain.id}, Name: ${chain.name}`;
    } catch (error) {
      console.error("Error in EVM wallet provider:", error);
      return null;
    }
  }
};

// src/templates/index.ts
var transferTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested transfer:
- Chain to execute on (like in viem/chains)
- Amount to transfer (only number without coin symbol)
- Recipient address

Respond with a JSON markdown block containing only the extracted values:

\`\`\`json
{
    "fromChain": SUPPORTED_CHAINS,
    "amount": string,
    "toAddress": string
}
\`\`\`
`;
var bridgeTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested token bridge:
- Token symbol or address to bridge
- Source chain
- Destination chain
- Amount to bridge
- Destination address (if specified)

Respond with a JSON markdown block containing only the extracted values:

\`\`\`json
{
    "token": string | null,
    "fromChain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | null,
    "toChain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | null,
    "amount": string | null,
    "toAddress": string | null
}
\`\`\`
`;
var swapTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested token swap:
- Input token symbol or address (the token being sold)
- Output token symbol or address (the token being bought)
- Amount to swap
- Chain to execute on

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined:

\`\`\`json
{
    "inputToken": string | null,
    "outputToken": string | null,
    "amount": string | null,
    "chain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | null,
    "slippage": number | null
}
\`\`\`
`;

// src/actions/bridge.ts
var BridgeAction = class {
  constructor(walletProvider) {
    this.walletProvider = walletProvider;
    this.config = createConfig({
      integrator: "eliza",
      chains: Object.values(this.walletProvider.chains).map((config) => ({
        id: config.id,
        name: config.name,
        key: config.name.toLowerCase(),
        chainType: "EVM",
        nativeToken: {
          ...config.nativeCurrency,
          chainId: config.id,
          address: "0x0000000000000000000000000000000000000000",
          coinKey: config.nativeCurrency.symbol
        },
        metamask: {
          chainId: `0x${config.id.toString(16)}`,
          chainName: config.name,
          nativeCurrency: config.nativeCurrency,
          rpcUrls: [config.rpcUrls.default.http[0]],
          blockExplorerUrls: [config.blockExplorers.default.url]
        },
        diamondAddress: "0x0000000000000000000000000000000000000000",
        coin: config.nativeCurrency.symbol,
        mainnet: true
      }))
    });
  }
  config;
  async bridge(params) {
    const walletClient = this.walletProvider.getWalletClient(
      params.fromChain
    );
    const [fromAddress] = await walletClient.getAddresses();
    const routes = await getRoutes({
      fromChainId: this.walletProvider.getChainConfigs(params.fromChain).id,
      toChainId: this.walletProvider.getChainConfigs(params.toChain).id,
      fromTokenAddress: params.fromToken,
      toTokenAddress: params.toToken,
      fromAmount: params.amount,
      fromAddress,
      toAddress: params.toAddress || fromAddress
    });
    if (!routes.routes.length) throw new Error("No routes found");
    const execution = await executeRoute(routes.routes[0], this.config);
    const process = execution.steps[0]?.execution?.process[0];
    if (!process?.status || process.status === "FAILED") {
      throw new Error("Transaction failed");
    }
    return {
      hash: process.txHash,
      from: fromAddress,
      to: routes.routes[0].steps[0].estimate.approvalAddress,
      value: BigInt(params.amount),
      chainId: this.walletProvider.getChainConfigs(params.fromChain).id
    };
  }
};
var bridgeAction = {
  name: "bridge",
  description: "Bridge tokens between different chains",
  handler: async (runtime, message, state, options) => {
    const privateKey = runtime.getSetting(
      "EVM_PRIVATE_KEY"
    );
    const walletProvider = new WalletProvider(privateKey);
    const action = new BridgeAction(walletProvider);
    return action.bridge(options);
  },
  template: bridgeTemplate,
  validate: async (runtime) => {
    const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
    return typeof privateKey === "string" && privateKey.startsWith("0x");
  },
  examples: [
    [
      {
        user: "user",
        content: {
          text: "Bridge 1 ETH from Ethereum to Base",
          action: "CROSS_CHAIN_TRANSFER"
        }
      }
    ]
  ],
  similes: ["CROSS_CHAIN_TRANSFER", "CHAIN_BRIDGE", "MOVE_CROSS_CHAIN"]
};

// src/actions/swap.ts
import {
  createConfig as createConfig2,
  executeRoute as executeRoute2,
  getRoutes as getRoutes2
} from "@lifi/sdk";
var SwapAction = class {
  constructor(walletProvider) {
    this.walletProvider = walletProvider;
    this.config = createConfig2({
      integrator: "eliza",
      chains: Object.values(this.walletProvider.chains).map((config) => ({
        id: config.id,
        name: config.name,
        key: config.name.toLowerCase(),
        chainType: "EVM",
        nativeToken: {
          ...config.nativeCurrency,
          chainId: config.id,
          address: "0x0000000000000000000000000000000000000000",
          coinKey: config.nativeCurrency.symbol,
          priceUSD: "0",
          logoURI: "",
          symbol: config.nativeCurrency.symbol,
          decimals: config.nativeCurrency.decimals,
          name: config.nativeCurrency.name
        },
        rpcUrls: {
          public: { http: [config.rpcUrls.default.http[0]] }
        },
        blockExplorerUrls: [config.blockExplorers.default.url],
        metamask: {
          chainId: `0x${config.id.toString(16)}`,
          chainName: config.name,
          nativeCurrency: config.nativeCurrency,
          rpcUrls: [config.rpcUrls.default.http[0]],
          blockExplorerUrls: [config.blockExplorers.default.url]
        },
        coin: config.nativeCurrency.symbol,
        mainnet: true,
        diamondAddress: "0x0000000000000000000000000000000000000000"
      }))
    });
  }
  config;
  async swap(params) {
    const walletClient = this.walletProvider.getWalletClient(params.chain);
    const [fromAddress] = await walletClient.getAddresses();
    const routes = await getRoutes2({
      fromChainId: this.walletProvider.getChainConfigs(params.chain).id,
      toChainId: this.walletProvider.getChainConfigs(params.chain).id,
      fromTokenAddress: params.fromToken,
      toTokenAddress: params.toToken,
      fromAmount: params.amount,
      fromAddress,
      options: {
        slippage: params.slippage || 0.5,
        order: "RECOMMENDED"
      }
    });
    if (!routes.routes.length) throw new Error("No routes found");
    const execution = await executeRoute2(routes.routes[0], this.config);
    const process = execution.steps[0]?.execution?.process[0];
    if (!process?.status || process.status === "FAILED") {
      throw new Error("Transaction failed");
    }
    return {
      hash: process.txHash,
      from: fromAddress,
      to: routes.routes[0].steps[0].estimate.approvalAddress,
      value: BigInt(params.amount),
      data: process.data,
      chainId: this.walletProvider.getChainConfigs(params.chain).id
    };
  }
};
var swapAction = {
  name: "swap",
  description: "Swap tokens on the same chain",
  handler: async (runtime, message, state, options, callback) => {
    try {
      const privateKey = runtime.getSetting(
        "EVM_PRIVATE_KEY"
      );
      const walletProvider = new WalletProvider(privateKey);
      const action = new SwapAction(walletProvider);
      return await action.swap(options);
    } catch (error) {
      console.error("Error in swap handler:", error.message);
      if (callback) {
        callback({ text: `Error: ${error.message}` });
      }
      return false;
    }
  },
  template: swapTemplate,
  validate: async (runtime) => {
    const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
    return typeof privateKey === "string" && privateKey.startsWith("0x");
  },
  examples: [
    [
      {
        user: "user",
        content: {
          text: "Swap 1 ETH for USDC on Base",
          action: "TOKEN_SWAP"
        }
      }
    ]
  ],
  similes: ["TOKEN_SWAP", "EXCHANGE_TOKENS", "TRADE_TOKENS"]
};

// src/actions/transfer.ts
import { formatEther, parseEther } from "viem";
import {
  composeContext,
  generateObjectDEPRECATED,
  ModelClass
} from "@ai16z/eliza";
var TransferAction = class {
  constructor(walletProvider) {
    this.walletProvider = walletProvider;
  }
  async transfer(params) {
    console.log(
      `Transferring: ${params.amount} tokens to (${params.toAddress} on ${params.fromChain})`
    );
    const walletClient = this.walletProvider.getWalletClient(
      params.fromChain
    );
    try {
      const hash = await walletClient.sendTransaction({
        account: walletClient.account,
        to: params.toAddress,
        value: parseEther(params.amount),
        data: params.data,
        kzg: {
          blobToKzgCommitment: function(blob) {
            throw new Error("Function not implemented.");
          },
          computeBlobKzgProof: function(blob, commitment) {
            throw new Error("Function not implemented.");
          }
        },
        chain: void 0
      });
      return {
        hash,
        from: walletClient.account.address,
        to: params.toAddress,
        value: parseEther(params.amount),
        data: params.data
      };
    } catch (error) {
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }
};
var buildTransferDetails = async (state, runtime, wp) => {
  const context = composeContext({
    state,
    template: transferTemplate
  });
  const chains = Object.keys(wp.chains);
  const contextWithChains = context.replace(
    "SUPPORTED_CHAINS",
    chains.toString()
  );
  const transferDetails = await generateObjectDEPRECATED({
    runtime,
    context: contextWithChains,
    modelClass: ModelClass.SMALL
  });
  const existingChain = wp.chains[transferDetails.fromChain];
  if (!existingChain) {
    throw new Error(
      "The chain " + transferDetails.fromChain + " not configured yet. Add the chain or choose one from configured: " + chains.toString()
    );
  }
  return transferDetails;
};
var transferAction = {
  name: "transfer",
  description: "Transfer tokens between addresses on the same chain",
  handler: async (runtime, message, state, options, callback) => {
    try {
      const walletProvider = initWalletProvider(runtime);
      const action = new TransferAction(walletProvider);
      const transferDetails = await buildTransferDetails(
        state,
        runtime,
        walletProvider
      );
      const tx = await action.transfer(transferDetails);
      if (callback) {
        callback({
          text: `Successfully transferred ${formatEther(tx.value)} tokens to ${tx.to}
Transaction hash: ${tx.hash}
Chain: ${transferDetails.fromChain}`,
          content: {
            success: true,
            hash: tx.hash,
            amount: formatEther(tx.value),
            recipient: tx.to,
            chain: transferDetails.fromChain
          }
        });
      }
      return true;
    } catch (error) {
      console.error("Error during token transfer:", error);
      if (callback) {
        callback({
          text: `Error transferring tokens: ${error.message}`,
          content: { error: error.message }
        });
      }
      return false;
    }
  },
  template: transferTemplate,
  validate: async (runtime) => {
    const privateKey = runtime.getSetting("EVM_PRIVATE_KEY");
    return typeof privateKey === "string" && privateKey.startsWith("0x");
  },
  examples: [
    [
      {
        user: "assistant",
        content: {
          text: "I'll help you transfer 1 ETH to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
          action: "SEND_TOKENS"
        }
      },
      {
        user: "user",
        content: {
          text: "Transfer 1 ETH to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
          action: "SEND_TOKENS"
        }
      }
    ]
  ],
  similes: ["SEND_TOKENS", "TOKEN_TRANSFER", "MOVE_TOKENS"]
};

// src/types/index.ts
import * as viemChains2 from "viem/chains";
var SupportedChainList = Object.keys(viemChains2);

// src/index.ts
var evmPlugin = {
  name: "evm",
  description: "EVM blockchain integration plugin",
  providers: [evmWalletProvider],
  evaluators: [],
  services: [],
  actions: [transferAction, bridgeAction, swapAction]
};
var src_default = evmPlugin;
export {
  BridgeAction,
  SwapAction,
  TransferAction,
  WalletProvider,
  bridgeAction,
  bridgeTemplate,
  src_default as default,
  evmPlugin,
  evmWalletProvider,
  initWalletProvider,
  swapAction,
  swapTemplate,
  transferAction,
  transferTemplate
};
//# sourceMappingURL=index.js.map