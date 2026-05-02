import type { Duplex } from "readable-stream";
import type { JsonRpcRequest } from "../utils";
import type { StreamProviderOptions } from "./StreamProvider";
import { AbstractStreamProvider } from "./StreamProvider";
import { getDefaultExternalMiddleware } from "./utils";
import { QRL_WALLET_PROVIDER_NAME } from "@/constants/providerConstants";

export type SendSyncJsonRpcRequest = {
  method:
    | "eth_accounts"
    | "eth_coinbase"
    | "eth_uninstallFilter"
    | "net_version";
} & JsonRpcRequest;

export type QrlWalletInpageProviderOptions = {
  /**
   * Whether the provider should send page metadata.
   */
  shouldSendMetadata?: boolean;
  jsonRpcStreamName?: string | undefined;
} & Partial<Omit<StreamProviderOptions, "rpcMiddleware">>;

export class QrlWalletInpageProvider extends AbstractStreamProvider {
  #networkVersion: string | null;

  /**
   * Indicating that this provider is a QrlWallet provider.
   */
  public readonly isQrlWallet: true;

  /**
   * Creates a new `QrlWalletInpageProvider`.
   *
   * @param connectionStream - A Node.js duplex stream.
   * @param options - An options bag.
   * @param options.jsonRpcStreamName - The name of the internal JSON-RPC stream.
   * Default: `qrl-wallet-provider`.
   * @param options.logger - The logging API to use. Default: `console`.
   * @param options.maxEventListeners - The maximum number of event
   * listeners. Default: 100.
   * @param options.shouldSendMetadata - Whether the provider should
   * send page metadata. Default: `true`.
   */
  constructor(
    connectionStream: Duplex,
    {
      jsonRpcStreamName = QRL_WALLET_PROVIDER_NAME,
      logger = console,
      maxEventListeners = 100,
    }: QrlWalletInpageProviderOptions = {}
  ) {
    super(connectionStream, {
      jsonRpcStreamName,
      logger,
      maxEventListeners,
      rpcMiddleware: getDefaultExternalMiddleware(logger),
    });

    this._initializeStateAsync();

    this.#networkVersion = null;
    this.isQrlWallet = true;
  }

  //====================
  // Read-only Properties
  //====================

  get chainId(): string | null {
    return super.chainId;
  }

  get networkVersion(): string | null {
    return this.#networkVersion;
  }

  get selectedAddress(): string | null {
    return super.selectedAddress;
  }

  //====================
  // Private Methods
  //====================

  /**
   * When the provider becomes disconnected, updates internal state and emits
   * required events. Idempotent with respect to the isRecoverable parameter.
   *
   * Error codes per the CloseEvent status codes as required by EIP-1193:
   * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes.
   *
   * @param isRecoverable - Whether the disconnection is recoverable.
   * @param errorMessage - A custom error message.
   * @fires BaseProvider#disconnect - If the disconnection is not recoverable.
   */
  protected _handleDisconnect(isRecoverable: boolean, errorMessage?: string) {
    super._handleDisconnect(isRecoverable, errorMessage);
    if (this.#networkVersion && !isRecoverable) {
      this.#networkVersion = null;
    }
  }

  /**
   * Upon receipt of a new chainId and networkVersion, emits corresponding
   * events and sets relevant public state. Does nothing if neither the chainId
   * nor the networkVersion are different from existing values.
   *
   * @fires QrlWalletInpageProvider#networkChanged
   * @param networkInfo - An object with network info.
   * @param networkInfo.chainId - The latest chain ID.
   * @param networkInfo.networkVersion - The latest network ID.
   */
  protected _handleChainChanged({
    chainId,
    networkVersion,
  }: { chainId?: string; networkVersion?: string } = {}) {
    // This will validate the params and disconnect the provider if the
    // networkVersion is 'loading'.
    super._handleChainChanged({ chainId, networkVersion });

    if (this._state.isConnected && networkVersion !== this.#networkVersion) {
      this.#networkVersion = networkVersion as string;
      if (this._state.initialized) {
        this.emit("networkChanged", this.#networkVersion);
      }
    }
  }
}
