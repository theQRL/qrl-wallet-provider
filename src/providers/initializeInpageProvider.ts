import type { Duplex } from "readable-stream";
import type { EIP6963ProviderInfo } from "./EIP6963";
import { announceProvider } from "./EIP6963";
import type { QrlWalletInpageProviderOptions } from "./QrlWalletInpageProvider";
import { QrlWalletInpageProvider } from "./QrlWalletInpageProvider";

type InitializeProviderOptions = {
  /**
   * The stream used to connect to the wallet.
   */
  connectionStream: Duplex;
  /**
   * The EIP-6963 provider info that should be announced if set.
   */
  providerInfo: EIP6963ProviderInfo;
} & QrlWalletInpageProviderOptions;

/**
 * Initializes a QrlWalletInpageProvider.
 *
 * @param options - An options bag.
 * @param options.connectionStream - A Node.js stream.
 * @param options.jsonRpcStreamName - The name of the internal JSON-RPC stream.
 * @param options.logger - The logging API to use. Default: `console`.
 * @param options.maxEventListeners - The maximum number of event listeners.
 * @param options.providerInfo - The EIP-6963 provider info that should be announced if set.
 * @param options.shouldSendMetadata - Whether the provider should send page metadata.
 * @returns The initialized provider (whether set or not).
 */
export function initializeProvider({
  connectionStream,
  jsonRpcStreamName,
  logger = console,
  maxEventListeners = 100,
  providerInfo,
}: InitializeProviderOptions): QrlWalletInpageProvider {
  const provider = new QrlWalletInpageProvider(connectionStream, {
    jsonRpcStreamName,
    logger,
    maxEventListeners,
  });

  const proxiedProvider = new Proxy(provider, {
    // some common libraries, e.g. web3@1.x, mess with our API
    deleteProperty: () => true,
    // fix issue with Proxy unable to access private variables from getters
    // https://stackoverflow.com/a/73051482
    get(target, propName: "chainId" | "networkVersion" | "selectedAddress") {
      return target[propName];
    },
  });

  // Announces provider based on EIP-6963, so that dApps can detect the QRL wallet
  announceProvider({
    info: providerInfo,
    provider: proxiedProvider,
  });

  return proxiedProvider;
}
