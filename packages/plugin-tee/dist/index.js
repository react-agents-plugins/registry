// src/providers/remoteAttestationProvider.ts
import { TappdClient } from "@phala/dstack-sdk";

// src/types/tee.ts
var TEEMode = /* @__PURE__ */ ((TEEMode2) => {
  TEEMode2["OFF"] = "OFF";
  TEEMode2["LOCAL"] = "LOCAL";
  TEEMode2["DOCKER"] = "DOCKER";
  TEEMode2["PRODUCTION"] = "PRODUCTION";
  return TEEMode2;
})(TEEMode || {});

// src/providers/remoteAttestationProvider.ts
var RemoteAttestationProvider = class {
  client;
  constructor(teeMode) {
    let endpoint;
    switch (teeMode) {
      case "LOCAL" /* LOCAL */:
        endpoint = "http://localhost:8090";
        console.log("TEE: Connecting to local simulator at localhost:8090");
        break;
      case "DOCKER" /* DOCKER */:
        endpoint = "http://host.docker.internal:8090";
        console.log("TEE: Connecting to simulator via Docker at host.docker.internal:8090");
        break;
      case "PRODUCTION" /* PRODUCTION */:
        endpoint = void 0;
        console.log("TEE: Running in production mode without simulator");
        break;
      default:
        throw new Error(`Invalid TEE_MODE: ${teeMode}. Must be one of: LOCAL, DOCKER, PRODUCTION`);
    }
    this.client = endpoint ? new TappdClient(endpoint) : new TappdClient();
  }
  async generateAttestation(reportData) {
    try {
      console.log("Generating attestation for: ", reportData);
      const tdxQuote = await this.client.tdxQuote(reportData);
      const rtmrs = tdxQuote.replayRtmrs();
      console.log(`rtmr0: ${rtmrs[0]}
rtmr1: ${rtmrs[1]}
rtmr2: ${rtmrs[2]}
rtmr3: ${rtmrs[3]}f`);
      const quote = {
        quote: tdxQuote.quote,
        timestamp: Date.now()
      };
      console.log("Remote attestation quote: ", quote);
      return quote;
    } catch (error) {
      console.error("Error generating remote attestation:", error);
      throw new Error(
        `Failed to generate TDX Quote: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
};
var remoteAttestationProvider = {
  get: async (runtime, _message, _state) => {
    const teeMode = runtime.getSetting("TEE_MODE");
    const provider = new RemoteAttestationProvider(teeMode);
    const agentId = runtime.agentId;
    try {
      console.log("Generating attestation for: ", agentId);
      const attestation = await provider.generateAttestation(agentId);
      return `Your Agent's remote attestation is: ${JSON.stringify(attestation)}`;
    } catch (error) {
      console.error("Error in remote attestation provider:", error);
      throw new Error(
        `Failed to generate TDX Quote: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
};

// src/providers/deriveKeyProvider.ts
import { Keypair } from "@solana/web3.js";
import crypto from "crypto";
import { TappdClient as TappdClient2 } from "@phala/dstack-sdk";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256 } from "viem";
var DeriveKeyProvider = class {
  client;
  raProvider;
  constructor(teeMode) {
    let endpoint;
    switch (teeMode) {
      case "LOCAL" /* LOCAL */:
        endpoint = "http://localhost:8090";
        console.log("TEE: Connecting to local simulator at localhost:8090");
        break;
      case "DOCKER" /* DOCKER */:
        endpoint = "http://host.docker.internal:8090";
        console.log("TEE: Connecting to simulator via Docker at host.docker.internal:8090");
        break;
      case "PRODUCTION" /* PRODUCTION */:
        endpoint = void 0;
        console.log("TEE: Running in production mode without simulator");
        break;
      default:
        throw new Error(`Invalid TEE_MODE: ${teeMode}. Must be one of: LOCAL, DOCKER, PRODUCTION`);
    }
    this.client = endpoint ? new TappdClient2(endpoint) : new TappdClient2();
    this.raProvider = new RemoteAttestationProvider(teeMode);
  }
  async generateDeriveKeyAttestation(agentId, publicKey) {
    const deriveKeyData = {
      agentId,
      publicKey
    };
    const reportdata = JSON.stringify(deriveKeyData);
    console.log("Generating Remote Attestation Quote for Derive Key...");
    const quote = await this.raProvider.generateAttestation(reportdata);
    console.log("Remote Attestation Quote generated successfully!");
    return quote;
  }
  async rawDeriveKey(path, subject) {
    try {
      if (!path || !subject) {
        console.error(
          "Path and Subject are required for key derivation"
        );
      }
      console.log("Deriving Raw Key in TEE...");
      const derivedKey = await this.client.deriveKey(path, subject);
      console.log("Raw Key Derived Successfully!");
      return derivedKey;
    } catch (error) {
      console.error("Error deriving raw key:", error);
      throw error;
    }
  }
  async deriveEd25519Keypair(path, subject, agentId) {
    try {
      if (!path || !subject) {
        console.error(
          "Path and Subject are required for key derivation"
        );
      }
      console.log("Deriving Key in TEE...");
      const derivedKey = await this.client.deriveKey(path, subject);
      const uint8ArrayDerivedKey = derivedKey.asUint8Array();
      const hash = crypto.createHash("sha256");
      hash.update(uint8ArrayDerivedKey);
      const seed = hash.digest();
      const seedArray = new Uint8Array(seed);
      const keypair = Keypair.fromSeed(seedArray.slice(0, 32));
      const attestation = await this.generateDeriveKeyAttestation(
        agentId,
        keypair.publicKey.toBase58()
      );
      console.log("Key Derived Successfully!");
      return { keypair, attestation };
    } catch (error) {
      console.error("Error deriving key:", error);
      throw error;
    }
  }
  async deriveEcdsaKeypair(path, subject, agentId) {
    try {
      if (!path || !subject) {
        console.error(
          "Path and Subject are required for key derivation"
        );
      }
      console.log("Deriving ECDSA Key in TEE...");
      const deriveKeyResponse = await this.client.deriveKey(path, subject);
      const hex = keccak256(deriveKeyResponse.asUint8Array());
      const keypair = privateKeyToAccount(hex);
      const attestation = await this.generateDeriveKeyAttestation(
        agentId,
        keypair.address
      );
      console.log("ECDSA Key Derived Successfully!");
      return { keypair, attestation };
    } catch (error) {
      console.error("Error deriving ecdsa key:", error);
      throw error;
    }
  }
};
var deriveKeyProvider = {
  get: async (runtime, _message, _state) => {
    const teeMode = runtime.getSetting("TEE_MODE");
    const provider = new DeriveKeyProvider(teeMode);
    const agentId = runtime.agentId;
    try {
      if (!runtime.getSetting("WALLET_SECRET_SALT")) {
        console.error(
          "Wallet secret salt is not configured in settings"
        );
        return "";
      }
      try {
        const secretSalt = runtime.getSetting("WALLET_SECRET_SALT") || "secret_salt";
        const solanaKeypair = await provider.deriveEd25519Keypair(
          "/",
          secretSalt,
          agentId
        );
        const evmKeypair = await provider.deriveEcdsaKeypair(
          "/",
          secretSalt,
          agentId
        );
        return JSON.stringify({
          solana: solanaKeypair.keypair.publicKey,
          evm: evmKeypair.keypair.address
        });
      } catch (error) {
        console.error("Error creating PublicKey:", error);
        return "";
      }
    } catch (error) {
      console.error("Error in derive key provider:", error.message);
      return `Failed to fetch derive key information: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }
};

// src/index.ts
var teePlugin = {
  name: "tee",
  description: "TEE plugin with actions to generate remote attestations and derive keys",
  actions: [
    /* custom actions */
  ],
  evaluators: [
    /* custom evaluators */
  ],
  providers: [
    /* custom providers */
    remoteAttestationProvider,
    deriveKeyProvider
  ],
  services: [
    /* custom services */
  ]
};
export {
  DeriveKeyProvider,
  RemoteAttestationProvider,
  TEEMode,
  teePlugin
};
//# sourceMappingURL=index.js.map