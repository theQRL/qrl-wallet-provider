import { QRL_WALLET_PROVIDER_NAME } from "@/constants/providerConstants";
import type { JsonRpcRequest } from "../utils";

import messages from "./messages";
import { MockConnectionStream } from "./test/mocks/MockConnectionStream";
import { QrlWalletInpageProvider } from "./QrlWalletInpageProvider";

const QrlWalletInpageProviderStreamName = QRL_WALLET_PROVIDER_NAME;

/**
 * A fully initialized inpage provider, and additional mocks to help
 * test the provider.
 */
type InitializedProviderDetails = {
  /** The initialized provider, created using a mocked connection stream. */
  provider: QrlWalletInpageProvider;
  /** The mock connection stream used to create the provider. */
  connectionStream: MockConnectionStream;
  /**
   * A mock function that can be used to inspect what gets written to the
   * mock connection Stream.
   */
  onWrite: ReturnType<typeof jest.fn>;
};

/**
 * For legacy purposes, QrlWalletInpageProvider retrieves state from the wallet
 * in its constructor. This operation is asynchronous, and initiated via
 * {@link QrlWalletInpageProvider._initializeStateAsync}. This helper function
 * returns a provider initialized with the specified values.
 *
 * The mock connection stream used to create the provider is also returned.
 * This stream is setup initially just to respond to the
 * `qrlWallet_getProviderState` method. Further responses can be setup via the
 * `onMethodCalled` configuration, or sent using the connection stream
 * directly.
 *
 * @param options - Options bag.
 * @param options.initialState - The initial provider state returned on
 * initialization.  See {@link QrlWalletInpageProvider._initializeState}.
 * @param options.onMethodCalled - A set of configuration objects for adding
 * method-specific callbacks.
 * @returns The initialized provider, its stream, and an "onWrite" stub that
 * can be used to inspect message sent by the provider.
 */
async function getInitializedProvider({
  initialState: {
    accounts = [],
    chainId = "0x0",
    networkVersion = "0",
  } = {},
  onMethodCalled = [],
}: {
  initialState?: Partial<
    Parameters<QrlWalletInpageProvider["_initializeState"]>[0]
  >;
  onMethodCalled?: {
    substream: string;
    method: string;
    callback: (data: JsonRpcRequest) => void;
  }[];
} = {}): Promise<InitializedProviderDetails> {
  const onWrite = jest.fn();
  const connectionStream = new MockConnectionStream((name, data) => {
    if (
      name === "qrl-wallet-provider" &&
      data.method === "qrlWallet_getProviderState"
    ) {
      // Wrap in `setTimeout` to ensure a reply is received by the provider
      // after the provider has processed the request, to ensure that the
      // provider recognizes the id.
      setTimeout(() =>
        connectionStream.reply("qrl-wallet-provider", {
          id: onWrite.mock.calls[0][1].id,
          jsonrpc: "2.0",
          result: {
            accounts,
            chainId,
            networkVersion,
          },
        })
      );
    }
    for (const { substream, method, callback } of onMethodCalled) {
      if (name === substream && data.method === method) {
        // Wrap in `setTimeout` to ensure a reply is received by the provider
        // after the provider has processed the request, to ensure that the
        // provider recognizes the id.
        setTimeout(() => callback(data));
      }
    }
    onWrite(name, data);
  });

  const provider = new QrlWalletInpageProvider(connectionStream);
  await new Promise<void>((resolve: () => void) => {
    provider.on("_initialized", resolve);
  });

  return { provider, connectionStream, onWrite };
}

describe("QrlWalletInpageProvider: RPC", () => {
  const MOCK_ERROR_MESSAGE = "Did you specify a mock return value?";

  /**
   * Creates a new QrlWalletInpageProvider instance, with a mocked connection
   * stream.
   *
   * @returns The new QrlWalletInpageProvider instance.
   */
  function initializeProvider() {
    const mockStream = new MockConnectionStream();
    const provider: any | QrlWalletInpageProvider =
      new QrlWalletInpageProvider(mockStream);
    provider.mockStream = mockStream;
    provider.autoRefreshOnNetworkChange = false;
    return provider;
  }

  // mocking the underlying stream, and testing the basic functionality of
  // .reqest, .sendAsync, and .send
  describe("integration", () => {
    let provider: any | QrlWalletInpageProvider;
    const mockRpcEngineResponse = jest
      .fn()
      .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined]);

    const setNextRpcEngineResponse = (
      error: Error | null = null,
      response = {}
    ) => {
      mockRpcEngineResponse.mockReturnValueOnce([error, response]);
    };

    beforeEach(() => {
      provider = initializeProvider();
      jest.spyOn(provider, "_handleAccountsChanged").mockImplementation();
      jest
        .spyOn(provider._rpcEngine, "handle")
        .mockImplementation((_payload, callback: any) =>
          // eslint-disable-next-line n/no-callback-literal
          callback(...mockRpcEngineResponse())
        );
    });

    it(".request returns result on success", async () => {
      setNextRpcEngineResponse(null, { result: 42 });
      const result = await provider.request({ method: "foo", params: ["bar"] });
      expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "foo",
          params: ["bar"],
        }),
        expect.any(Function)
      );

      expect(result).toBe(42);
    });

    it(".request throws on error", async () => {
      setNextRpcEngineResponse(new Error("foo"));

      await expect(
        provider.request({ method: "foo", params: ["bar"] })
      ).rejects.toThrow("foo");

      expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "foo",
          params: ["bar"],
        }),
        expect.any(Function)
      );
    });
  });

  describe(".request", () => {
    let provider: any;
    const mockRpcRequestResponse = jest
      .fn()
      .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined]);

    const setNextRpcRequestResponse = (
      error: Error | null = null,
      response = {}
    ) => {
      mockRpcRequestResponse.mockReturnValueOnce([error, response]);
    };

    beforeEach(() => {
      provider = initializeProvider();
      jest
        .spyOn(provider, "_rpcRequest")
        .mockImplementation((_payload, callback: any, _isInternal) =>
          // eslint-disable-next-line n/no-callback-literal
          callback(...mockRpcRequestResponse())
        );
    });

    it("returns result on success", async () => {
      setNextRpcRequestResponse(null, { result: 42 });
      const result = await provider.request({ method: "foo", params: ["bar"] });

      expect(result).toBe(42);

      expect(provider._rpcRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "foo",
          params: ["bar"],
        }),
        expect.any(Function)
      );
    });

    it("throws on error", async () => {
      setNextRpcRequestResponse(new Error("foo"));

      await expect(
        provider.request({ method: "foo", params: ["bar"] })
      ).rejects.toThrow("foo");

      expect(provider._rpcRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "foo",
          params: ["bar"],
        }),
        expect.any(Function)
      );
    });

    it("throws on non-object args", async () => {
      await expect(() => provider.request()).rejects.toThrow(
        messages.errors.invalidRequestArgs()
      );

      await expect(() => provider.request(null)).rejects.toThrow(
        messages.errors.invalidRequestArgs()
      );

      await expect(() => provider.request([])).rejects.toThrow(
        messages.errors.invalidRequestArgs()
      );

      await expect(() => provider.request("foo")).rejects.toThrow(
        messages.errors.invalidRequestArgs()
      );
    });

    it("throws on invalid args.method", async () => {
      await expect(() => provider.request({})).rejects.toThrow(
        messages.errors.invalidRequestMethod()
      );

      await expect(() => provider.request({ method: null })).rejects.toThrow(
        messages.errors.invalidRequestMethod()
      );

      await expect(() => provider.request({ method: 2 })).rejects.toThrow(
        messages.errors.invalidRequestMethod()
      );

      await expect(() => provider.request({ method: "" })).rejects.toThrow(
        messages.errors.invalidRequestMethod()
      );
    });

    it("throws on invalid args.params", async () => {
      await expect(() =>
        provider.request({ method: "foo", params: null })
      ).rejects.toThrow(messages.errors.invalidRequestParams());

      await expect(() =>
        provider.request({ method: "foo", params: 2 })
      ).rejects.toThrow(messages.errors.invalidRequestParams());

      await expect(() =>
        provider.request({ method: "foo", params: true })
      ).rejects.toThrow(messages.errors.invalidRequestParams());

      await expect(() =>
        provider.request({ method: "foo", params: "a" })
      ).rejects.toThrow(messages.errors.invalidRequestParams());
    });
  });

  // this also tests sendAsync, it being effectively an alias for this method
  describe("._rpcRequest", () => {
    let provider: any | QrlWalletInpageProvider;
    const mockRpcEngineResponse = jest
      .fn()
      .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined]);

    const setNextRpcEngineResponse = (
      error: Error | null = null,
      response = {}
    ) => {
      mockRpcEngineResponse.mockReturnValueOnce([error, response]);
    };

    beforeEach(() => {
      provider = initializeProvider();
      jest.spyOn(provider, "_handleAccountsChanged").mockImplementation();
      jest
        .spyOn(provider._rpcEngine, "handle")
        .mockImplementation((_payload, callback: any) =>
          // eslint-disable-next-line n/no-callback-literal
          callback(...mockRpcEngineResponse())
        );
    });

    it("returns response object on success", async () => {
      setNextRpcEngineResponse(null, { result: 42 });
      await new Promise((done) => {
        provider._rpcRequest(
          { method: "foo", params: ["bar"] },
          (error: any, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: "foo",
                params: ["bar"],
              }),
              expect.any(Function)
            );

            expect(error).toBeNull();
            expect(response).toStrictEqual({ result: 42 });
            done(undefined);
          }
        );
      });
    });

    it("returns response object on error", async () => {
      setNextRpcEngineResponse(new Error("foo"), { error: "foo" });
      await new Promise((done) => {
        provider._rpcRequest(
          { method: "foo", params: ["bar"] },
          (error: any, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: "foo",
                params: ["bar"],
              }),
              expect.any(Function)
            );

            expect(error).toStrictEqual(new Error("foo"));
            expect(response).toStrictEqual({ error: "foo" });
            done(undefined);
          }
        );
      });
    });

    it("calls _handleAccountsChanged on request for qrl_accounts", async () => {
      setNextRpcEngineResponse(null, { result: ["0x1"] });
      await new Promise((done) => {
        provider._rpcRequest(
          { method: "qrl_accounts" },
          (error: any, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({ method: "qrl_accounts" }),
              expect.any(Function)
            );

            expect(provider._handleAccountsChanged).toHaveBeenCalledWith(["0x1"]);

            expect(error).toBeNull();
            expect(response).toStrictEqual({ result: ["0x1"] });
            done(undefined);
          }
        );
      });
    });

    it("leaves account state alone when qrl_accounts fails", async () => {
      setNextRpcEngineResponse(new Error("foo"), { error: "foo" });
      await new Promise((done) => {
        provider._rpcRequest(
          { method: "qrl_accounts" },
          (error: any, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({ method: "qrl_accounts" }),
              expect.any(Function)
            );

            expect(provider._handleAccountsChanged).not.toHaveBeenCalled();

            expect(error).toStrictEqual(new Error("foo"));
            expect(response).toStrictEqual({ error: "foo" });
            done(undefined);
          }
        );
      });
    });
  });

  it("keeps an account reply that arrives before the initial state", async () => {
    const account = `Q${"ab".repeat(64)}`;
    let initialRequestId: JsonRpcRequest["id"];
    const stream = new MockConnectionStream((name, { id, method }) => {
      if (method === "qrlWallet_getProviderState") {
        initialRequestId = id;
      } else if (method === "qrl_accounts") {
        stream.reply(name, { jsonrpc: "2.0", id, result: [account] });
      }
    });
    const provider = new QrlWalletInpageProvider(stream);
    const initialized = new Promise((resolve) => provider.once("_initialized", resolve));

    await expect(provider.request({ method: "qrl_accounts" })).resolves.toEqual([account]);
    stream.reply(QrlWalletInpageProviderStreamName, {
      jsonrpc: "2.0",
      id: initialRequestId!,
      result: { accounts: [], chainId: "0x1234", networkVersion: "4660" },
    });
    await initialized;

    expect(provider.selectedAddress).toBe(account);
  });

  it("tracks full-length QRL accounts across requests and notifications", async () => {
    const initialAccount = `Q${"12".repeat(64)}`;
    const grantedAccount = `Q${"ab".repeat(64)}`;
    let rejectRequest = false;
    const { provider, connectionStream } = await getInitializedProvider({
      initialState: { accounts: [initialAccount] },
      onMethodCalled: [
        {
          substream: QrlWalletInpageProviderStreamName,
          method: "qrl_requestAccounts",
          callback: ({ id }) => {
            connectionStream.reply(QrlWalletInpageProviderStreamName, {
              jsonrpc: "2.0",
              id,
              ...(rejectRequest
                ? { error: { code: 4001, message: "User rejected the request." } }
                : { result: [grantedAccount] }),
            });
          },
        },
        {
          substream: QrlWalletInpageProviderStreamName,
          method: "qrl_accounts",
          callback: ({ id }) => {
            connectionStream.reply(QrlWalletInpageProviderStreamName, {
              jsonrpc: "2.0",
              id,
              result: [],
            });
          },
        },
      ],
    });

    const accountsChanged = jest.fn();
    provider.on("accountsChanged", accountsChanged);
    expect(provider.selectedAddress).toBe(initialAccount);

    await expect(provider.request({ method: "qrl_requestAccounts" })).resolves.toEqual([grantedAccount]);
    expect(provider.selectedAddress).toBe(grantedAccount);
    expect(accountsChanged).toHaveBeenCalledWith([grantedAccount]);

    connectionStream.notify(QrlWalletInpageProviderStreamName, {
      jsonrpc: "2.0",
      method: "qrlWallet_accountsChanged",
      params: [grantedAccount],
    });
    connectionStream.notify(QrlWalletInpageProviderStreamName, {
      jsonrpc: "2.0",
      method: "qrlWallet_unlockStateChanged",
      params: { isUnlocked: false, accounts: [] },
    });
    rejectRequest = true;
    await expect(provider.request({ method: "qrl_requestAccounts" })).rejects.toMatchObject({ code: 4001 });
    expect(provider.selectedAddress).toBe(grantedAccount);
    expect(accountsChanged).toHaveBeenCalledTimes(1);

    await expect(provider.request({ method: "qrl_accounts" })).resolves.toEqual([]);
    expect(provider.selectedAddress).toBeNull();
    expect(accountsChanged.mock.calls).toEqual([[[grantedAccount]], [[]]]);
  });

  describe("provider events", () => {
    it("emits QRL subscription notifications as provider messages", async () => {
      const { provider, connectionStream } = await getInitializedProvider();
      const params = { subscription: "0x1", result: { number: "0x2" } };
      const received = new Promise((resolve) => provider.once("message", resolve));

      connectionStream.notify(QrlWalletInpageProviderStreamName, {
        jsonrpc: "2.0",
        method: "qrl_subscription",
        params,
      });

      await expect(received).resolves.toEqual({
        type: "qrl_subscription",
        data: params,
      });
    });

    it("calls chainChanged when receiving a new chainId", async () => {
      const { provider, connectionStream } = await getInitializedProvider();

      await new Promise((resolve) => {
        provider.once("chainChanged", (newChainId) => {
          expect(newChainId).toBe("0x1");
          resolve(undefined);
        });

        connectionStream.notify(QrlWalletInpageProviderStreamName, {
          jsonrpc: "2.0",
          method: "qrlWallet_chainChanged",
          params: { chainId: "0x1", networkVersion: "1" },
        });
      });
    });

    it("calls networkChanged when receiving a new networkVersion", async () => {
      const { provider, connectionStream } = await getInitializedProvider();

      await new Promise((resolve) => {
        provider.once("networkChanged", (newNetworkId) => {
          expect(newNetworkId).toBe("1");
          resolve(undefined);
        });

        connectionStream.notify(QrlWalletInpageProviderStreamName, {
          jsonrpc: "2.0",
          method: "qrlWallet_chainChanged",
          params: { chainId: "0x1", networkVersion: "1" },
        });
      });
    });

    it("handles chain changes with intermittent disconnection", async () => {
      const { provider, connectionStream } = await getInitializedProvider();

      // We check this mostly for the readability of this test.
      expect(provider.isConnected()).toBe(true);
      expect(provider.chainId).toBe("0x0");
      expect(provider.networkVersion).toBe("0");

      const emitSpy = jest.spyOn(provider, "emit");

      await new Promise<void>((resolve) => {
        provider.once("disconnect", (error) => {
          expect((error as any).code).toBe(1013);
          resolve();
        });

        connectionStream.notify(QrlWalletInpageProviderStreamName, {
          jsonrpc: "2.0",
          method: "qrlWallet_chainChanged",
          // A "loading" networkVersion indicates the network is changing.
          // Although the chainId is different, chainChanged should not be
          // emitted in this case.
          params: { chainId: "0x1", networkVersion: "loading" },
        });
      });

      // Only once, for "disconnect".
      expect(emitSpy).toHaveBeenCalledTimes(1);
      emitSpy.mockClear(); // Clear the mock to avoid keeping a count.

      expect(provider.isConnected()).toBe(false);
      // These should be unchanged.
      expect(provider.chainId).toBe("0x0");
      expect(provider.networkVersion).toBe("0");

      await new Promise<void>((resolve) => {
        provider.once("chainChanged", (newChainId) => {
          expect(newChainId).toBe("0x1");
          resolve();
        });

        connectionStream.notify(QrlWalletInpageProviderStreamName, {
          jsonrpc: "2.0",
          method: "qrlWallet_chainChanged",
          params: { chainId: "0x1", networkVersion: "1" },
        });
      });

      expect(emitSpy).toHaveBeenCalledTimes(3);
      expect(emitSpy).toHaveBeenNthCalledWith(1, "connect", { chainId: "0x1" });
      expect(emitSpy).toHaveBeenCalledWith("chainChanged", "0x1");
      expect(emitSpy).toHaveBeenCalledWith("networkChanged", "1");

      expect(provider.isConnected()).toBe(true);
      expect(provider.chainId).toBe("0x1");
      expect(provider.networkVersion).toBe("1");
    });
  });

  describe("constructor", () => {
    it("succeeds if stream is provided", () => {
      expect(
        () => new QrlWalletInpageProvider(new MockConnectionStream())
      ).not.toThrow();
    });

    it("succeeds if stream and valid options are provided", () => {
      const stream = new MockConnectionStream();

      expect(
        () =>
          new QrlWalletInpageProvider(stream, {
            maxEventListeners: 10,
          })
      ).not.toThrow();

      expect(
        () =>
          new QrlWalletInpageProvider(stream, {
            shouldSendMetadata: false,
          })
      ).not.toThrow();

      expect(
        () =>
          new QrlWalletInpageProvider(stream, {
            maxEventListeners: 10,
            shouldSendMetadata: false,
          })
      ).not.toThrow();
    });

    it("throws if no or invalid stream is provided", () => {
      expect(() => new QrlWalletInpageProvider(undefined as any)).toThrow(
        messages.errors.invalidDuplexStream()
      );

      expect(() => new QrlWalletInpageProvider("foo" as any)).toThrow(
        messages.errors.invalidDuplexStream()
      );

      expect(() => new QrlWalletInpageProvider({} as any)).toThrow(
        messages.errors.invalidDuplexStream()
      );
    });

    it("accepts valid custom logger", () => {
      const stream = new MockConnectionStream();
      const customLogger = {
        debug: console.debug,
        error: console.error,
        info: console.info,
        log: console.log,
        trace: console.trace,
        warn: console.warn,
      };

      expect(
        () =>
          new QrlWalletInpageProvider(stream, {
            logger: customLogger,
          })
      ).not.toThrow();
    });

    it("gets initial state", async () => {
      // This will be called via the constructor
      const requestMock = jest
        .spyOn(QrlWalletInpageProvider.prototype, "request")
        .mockImplementationOnce(async () => {
          return {
            accounts: ["0xabc"],
            chainId: "0x0",
            networkVersion: "0",
          };
        });

      const mockStream = new MockConnectionStream();
      const inpageProvider = new QrlWalletInpageProvider(mockStream);

      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1));
      expect(requestMock).toHaveBeenCalledTimes(1);
      expect(inpageProvider.chainId).toBe("0x0");
      expect(inpageProvider.networkVersion).toBe("0");
      expect(inpageProvider.selectedAddress).toBe("0xabc");
      expect(inpageProvider.isConnected()).toBe(true);
    });
  });

  describe("isConnected", () => {
    it("returns isConnected state", () => {
      const provider: any = new QrlWalletInpageProvider(
        new MockConnectionStream()
      );
      provider.autoRefreshOnNetworkChange = false;

      expect(provider.isConnected()).toBe(false);

      // Drive state changes through the protected lifecycle handlers
      // rather than poking at the now-truly-private #state directly.
      provider._handleConnect("0x1");

      expect(provider.isConnected()).toBe(true);

      provider._handleDisconnect(true);

      expect(provider.isConnected()).toBe(false);
    });
  });

  describe("isQrlWallet", () => {
    it('should be set to "true"', async () => {
      const { provider } = await getInitializedProvider();

      expect(provider.isQrlWallet).toBe(true);
    });
  });

  describe("chainId", () => {
    let provider: any | QrlWalletInpageProvider;

    beforeEach(async () => {
      provider = (
        await getInitializedProvider({
          initialState: {
            chainId: "0x5",
          },
        })
      ).provider;
    });

    it("should not allow chainId to be modified", () => {
      expect(() => (provider.chainId = "0x539")).toThrow(
        "Cannot set property chainId"
      );
      expect(provider.chainId).toBe("0x5");
    });
  });

  describe("networkVersion", () => {
    let provider: any | QrlWalletInpageProvider;

    beforeEach(async () => {
      provider = (
        await getInitializedProvider({
          initialState: {
            networkVersion: "5",
          },
        })
      ).provider;
    });

    it("should not allow networkVersion to be modified", () => {
      expect(() => (provider.networkVersion = "1337")).toThrow(
        "Cannot set property networkVersion"
      );
      expect(provider.networkVersion).toBe("5");
    });
  });

  describe("selectedAddress", () => {
    let provider: any | QrlWalletInpageProvider;

    beforeEach(async () => {
      provider = (
        await getInitializedProvider({
          initialState: {
            accounts: ["0xdeadbeef"],
          },
        })
      ).provider;
    });

    it("should not allow selectedAddress to be modified", () => {
      expect(() => (provider.selectedAddress = "0x12345678")).toThrow(
        "Cannot set property selectedAddress"
      );
      expect(provider.selectedAddress).toBe("0xdeadbeef");
    });
  });
});
