import { IAgentRuntime, Provider, Memory, State, HandlerCallback, Plugin } from '@ai16z/eliza';
import { Hash, Address, Chain, PublicClient, HttpTransport, Account, WalletClient, PrivateKeyAccount } from 'viem';
import { Token } from '@lifi/types';
import * as viemChains from 'viem/chains';

declare const SupportedChainList: Array<keyof typeof viemChains>;
type SupportedChain = (typeof SupportedChainList)[number];
interface Transaction {
    hash: Hash;
    from: Address;
    to: Address;
    value: bigint;
    data?: `0x${string}`;
    chainId?: number;
}
interface TokenWithBalance {
    token: Token;
    balance: bigint;
    formattedBalance: string;
    priceUSD: string;
    valueUSD: string;
}
interface WalletBalance {
    chain: SupportedChain;
    address: Address;
    totalValueUSD: string;
    tokens: TokenWithBalance[];
}
interface ChainMetadata {
    chainId: number;
    name: string;
    chain: Chain;
    rpcUrl: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    blockExplorerUrl: string;
}
interface ChainConfig {
    chain: Chain;
    publicClient: PublicClient<HttpTransport, Chain, Account | undefined>;
    walletClient?: WalletClient;
}
interface TransferParams {
    fromChain: SupportedChain;
    toAddress: Address;
    amount: string;
    data?: `0x${string}`;
}
interface SwapParams {
    chain: SupportedChain;
    fromToken: Address;
    toToken: Address;
    amount: string;
    slippage?: number;
}
interface BridgeParams {
    fromChain: SupportedChain;
    toChain: SupportedChain;
    fromToken: Address;
    toToken: Address;
    amount: string;
    toAddress?: Address;
}
interface EvmPluginConfig {
    rpcUrl?: {
        ethereum?: string;
        base?: string;
        sepolia?: string;
        bsc?: string;
        arbitrum?: string;
        avalanche?: string;
        polygon?: string;
        optimism?: string;
        cronos?: string;
        gnosis?: string;
        fantom?: string;
        klaytn?: string;
        celo?: string;
        moonbeam?: string;
        aurora?: string;
        harmonyOne?: string;
        moonriver?: string;
        arbitrumNova?: string;
        mantle?: string;
        linea?: string;
        scroll?: string;
        filecoin?: string;
        taiko?: string;
        zksync?: string;
        canto?: string;
    };
    secrets?: {
        EVM_PRIVATE_KEY: string;
    };
    testMode?: boolean;
    multicall?: {
        batchSize?: number;
        wait?: number;
    };
}
type LiFiStatus = {
    status: "PENDING" | "DONE" | "FAILED";
    substatus?: string;
    error?: Error;
};
type LiFiRoute = {
    transactionHash: Hash;
    transactionData: `0x${string}`;
    toAddress: Address;
    status: LiFiStatus;
};
interface TokenData extends Token {
    symbol: string;
    decimals: number;
    address: Address;
    name: string;
    logoURI?: string;
    chainId: number;
}
interface TokenPriceResponse {
    priceUSD: string;
    token: TokenData;
}
interface TokenListResponse {
    tokens: TokenData[];
}
interface ProviderError extends Error {
    code?: number;
    data?: unknown;
}

declare class WalletProvider {
    private currentChain;
    chains: Record<string, Chain>;
    account: PrivateKeyAccount;
    constructor(privateKey: `0x${string}`, chains?: Record<string, Chain>);
    getAddress(): Address;
    getCurrentChain(): Chain;
    getPublicClient(chainName: SupportedChain): PublicClient<HttpTransport, Chain, Account | undefined>;
    getWalletClient(chainName: SupportedChain): WalletClient;
    getChainConfigs(chainName: SupportedChain): Chain;
    getWalletBalance(): Promise<string | null>;
    getWalletBalanceForChain(chainName: SupportedChain): Promise<string | null>;
    addChain(chain: Record<string, Chain>): void;
    switchChain(chainName: SupportedChain, customRpcUrl?: string): void;
    private setAccount;
    private setChains;
    private setCurrentChain;
    private createHttpTransport;
    static genChainFromName(chainName: string, customRpcUrl?: string | null): Chain;
}
declare const initWalletProvider: (runtime: IAgentRuntime) => WalletProvider;
declare const evmWalletProvider: Provider;

declare const transferTemplate = "Given the recent messages and wallet information below:\n\n{{recentMessages}}\n\n{{walletInfo}}\n\nExtract the following information about the requested transfer:\n- Chain to execute on (like in viem/chains)\n- Amount to transfer (only number without coin symbol)\n- Recipient address\n\nRespond with a JSON markdown block containing only the extracted values:\n\n```json\n{\n    \"fromChain\": SUPPORTED_CHAINS,\n    \"amount\": string,\n    \"toAddress\": string\n}\n```\n";
declare const bridgeTemplate = "Given the recent messages and wallet information below:\n\n{{recentMessages}}\n\n{{walletInfo}}\n\nExtract the following information about the requested token bridge:\n- Token symbol or address to bridge\n- Source chain\n- Destination chain\n- Amount to bridge\n- Destination address (if specified)\n\nRespond with a JSON markdown block containing only the extracted values:\n\n```json\n{\n    \"token\": string | null,\n    \"fromChain\": \"ethereum\" | \"base\" | \"sepolia\" | \"bsc\" | \"arbitrum\" | \"avalanche\" | \"polygon\" | \"optimism\" | \"cronos\" | \"gnosis\" | \"fantom\" | \"klaytn\" | \"celo\" | \"moonbeam\" | \"aurora\" | \"harmonyOne\" | \"moonriver\" | \"arbitrumNova\" | \"mantle\" | \"linea\" | \"scroll\" | \"filecoin\" | \"taiko\" | \"zksync\" | \"canto\" | null,\n    \"toChain\": \"ethereum\" | \"base\" | \"sepolia\" | \"bsc\" | \"arbitrum\" | \"avalanche\" | \"polygon\" | \"optimism\" | \"cronos\" | \"gnosis\" | \"fantom\" | \"klaytn\" | \"celo\" | \"moonbeam\" | \"aurora\" | \"harmonyOne\" | \"moonriver\" | \"arbitrumNova\" | \"mantle\" | \"linea\" | \"scroll\" | \"filecoin\" | \"taiko\" | \"zksync\" | \"canto\" | null,\n    \"amount\": string | null,\n    \"toAddress\": string | null\n}\n```\n";
declare const swapTemplate = "Given the recent messages and wallet information below:\n\n{{recentMessages}}\n\n{{walletInfo}}\n\nExtract the following information about the requested token swap:\n- Input token symbol or address (the token being sold)\n- Output token symbol or address (the token being bought)\n- Amount to swap\n- Chain to execute on\n\nRespond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined:\n\n```json\n{\n    \"inputToken\": string | null,\n    \"outputToken\": string | null,\n    \"amount\": string | null,\n    \"chain\": \"ethereum\" | \"base\" | \"sepolia\" | \"bsc\" | \"arbitrum\" | \"avalanche\" | \"polygon\" | \"optimism\" | \"cronos\" | \"gnosis\" | \"fantom\" | \"klaytn\" | \"celo\" | \"moonbeam\" | \"aurora\" | \"harmonyOne\" | \"moonriver\" | \"arbitrumNova\" | \"mantle\" | \"linea\" | \"scroll\" | \"filecoin\" | \"taiko\" | \"zksync\" | \"canto\" | null,\n    \"slippage\": number | null\n}\n```\n";

declare class BridgeAction {
    private walletProvider;
    private config;
    constructor(walletProvider: WalletProvider);
    bridge(params: BridgeParams): Promise<Transaction>;
}
declare const bridgeAction: {
    name: string;
    description: string;
    handler: (runtime: IAgentRuntime, message: Memory, state: State, options: any) => Promise<Transaction>;
    template: string;
    validate: (runtime: IAgentRuntime) => Promise<boolean>;
    examples: {
        user: string;
        content: {
            text: string;
            action: string;
        };
    }[][];
    similes: string[];
};

declare class SwapAction {
    private walletProvider;
    private config;
    constructor(walletProvider: WalletProvider);
    swap(params: SwapParams): Promise<Transaction>;
}
declare const swapAction: {
    name: string;
    description: string;
    handler: (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any) => Promise<false | Transaction>;
    template: string;
    validate: (runtime: IAgentRuntime) => Promise<boolean>;
    examples: {
        user: string;
        content: {
            text: string;
            action: string;
        };
    }[][];
    similes: string[];
};

declare class TransferAction {
    private walletProvider;
    constructor(walletProvider: WalletProvider);
    transfer(params: TransferParams): Promise<Transaction>;
}
declare const transferAction: {
    name: string;
    description: string;
    handler: (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: HandlerCallback) => Promise<boolean>;
    template: string;
    validate: (runtime: IAgentRuntime) => Promise<boolean>;
    examples: {
        user: string;
        content: {
            text: string;
            action: string;
        };
    }[][];
    similes: string[];
};

declare const evmPlugin: Plugin;

export { BridgeAction, type BridgeParams, type ChainConfig, type ChainMetadata, type EvmPluginConfig, type LiFiRoute, type LiFiStatus, type ProviderError, type SupportedChain, SwapAction, type SwapParams, type TokenData, type TokenListResponse, type TokenPriceResponse, type TokenWithBalance, type Transaction, TransferAction, type TransferParams, type WalletBalance, WalletProvider, bridgeAction, bridgeTemplate, evmPlugin as default, evmPlugin, evmWalletProvider, initWalletProvider, swapAction, swapTemplate, transferAction, transferTemplate };
