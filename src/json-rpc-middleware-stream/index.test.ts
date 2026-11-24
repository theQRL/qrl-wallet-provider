import PortStream from "extension-port-stream";
import type { Duplex } from "stream";
import type { Runtime } from "webextension-polyfill";
import { JsonRpcEngine } from "../json-rpc-engine";

import { createEngineStream, createStreamMiddleware } from ".";

const artificialDelay = async (time = 0) =>
  new Promise((resolve) => setTimeout(resolve, time));
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = function (_a: any) {};

const jsonrpc = "2.0" as const;

describe("createStreamMiddleware", () => {
  it("ignores invalid envelopes and matches response IDs without coercion", async () => {
    const { stream, events, middleware } = createStreamMiddleware();
    const response: { jsonrpc: "2.0"; id: number; result?: null } = { jsonrpc, id: 0 };
    const req = { jsonrpc, id: 0, method: "qrl_test" };
    const finished = jest.fn();
    const notification = jest.fn();
    events.on("notification", notification);
    middleware(req, response, jest.fn(), finished);

    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      stream.write({ jsonrpc, id: "0", result: "wrong request" });
      stream.write({ jsonrpc, id: 0, result: true, error: { code: -1, message: "error" } });
      stream.write({ jsonrpc, id: 0, result: true, method: "unexpected" });
      stream.write({ jsonrpc: "1.0", method: "qrl_subscription" });
      stream.write({ jsonrpc, method: "", params: [] });
      await artificialDelay();

      expect(finished).not.toHaveBeenCalled();
      expect(notification).not.toHaveBeenCalled();
      expect(response).toEqual({ jsonrpc, id: 0 });

      stream.write({ jsonrpc, id: 0, result: null });
      stream.write({ jsonrpc, method: "qrl_subscription", params: [] });
      await artificialDelay();

      expect(finished).toHaveBeenCalledTimes(1);
      expect(response).toEqual({ jsonrpc, id: 0, result: null });
      expect(notification).toHaveBeenCalledWith({ jsonrpc, method: "qrl_subscription", params: [] });
    } finally {
      warn.mockRestore();
      stream.destroy();
    }
  });

  it("processes a request", async () => {
    const jsonRpcConnection = createStreamMiddleware();
    const req = { id: 1, jsonrpc, method: "test" };
    const initRes = { id: 1, jsonrpc };
    const res = { id: 1, jsonrpc, result: "test" };

    // listen for incoming requests
    jsonRpcConnection.stream.on("data", (_req) => {
      expect(req).toStrictEqual(_req);
      jsonRpcConnection.stream.write(res);
    });

    // wait for the stream to be ready
    await artificialDelay();

    await new Promise<void>((resolve, reject) => {
      // run middleware, expect end fn to be called
      jsonRpcConnection.middleware(
        req,
        initRes,
        () => {
          reject(new Error("should not call next"));
        },
        (errorObj) => {
          try {
            // eslint-disable-next-line jest/no-restricted-matchers
            expect(errorObj).toBeFalsy();
            expect(initRes).toStrictEqual(res);
          } catch (error) {
            return reject(error);
          }
          return resolve();
        }
      );
    });
  });
});

describe("createEngineStream", () => {
  it("processes a request", async () => {
    const engine = new JsonRpcEngine();
    engine.push((_req, res, _next, end) => {
      res.result = "test";
      end();
    });

    const stream = createEngineStream({ engine });
    const req = { id: 1, jsonrpc, method: "test" };
    const res = { id: 1, jsonrpc, result: "test" };

    await new Promise<void>((resolve, reject) => {
      // listen for incoming requests
      stream.on("data", (_res) => {
        try {
          expect(res).toStrictEqual(_res);
        } catch (error) {
          return reject(error);
        }
        return resolve();
      });

      stream.on("error", (errorObj) => {
        reject(errorObj);
      });

      stream.write(req);
    });
  });

  it("throw error when engine stream options not available", async () => {
    expect(() => {
      createEngineStream({} as any);
    }).toThrow("Missing engine parameter!");
  });
});

describe("middleware and engine to stream", () => {
  it("forwards messages between streams", async () => {
    // create guest
    const engineA = new JsonRpcEngine();
    const jsonRpcConnection = createStreamMiddleware();
    engineA.push(jsonRpcConnection.middleware);

    // create host
    const engineB = new JsonRpcEngine();
    engineB.push((_req, res, _next, end) => {
      res.result = "test";
      end();
    });

    // connect both
    const clientSideStream = jsonRpcConnection.stream;
    const hostSideStream = createEngineStream({ engine: engineB });
    clientSideStream.pipe(hostSideStream).pipe(clientSideStream);

    // request and expected result
    const req = { id: 1, jsonrpc, method: "test" };
    const res = { id: 1, jsonrpc, result: "test" };

    const response = await engineA.handle(req);
    expect(response).toStrictEqual(res);
  });
});

const RECONNECTED = "CONNECTED";
describe("retry logic in middleware connected to a port", () => {
  let clientSideStream: any;
  let engineA: JsonRpcEngine | undefined;
  let messages: any[] = [];
  let messageConsumer: any;
  beforeEach(() => {
    // create guest
    engineA = new JsonRpcEngine();
    const jsonRpcConnection = createStreamMiddleware({
      retryOnMessage: RECONNECTED,
    });
    engineA.push(jsonRpcConnection.middleware);

    // create port
    messageConsumer = noop;
    messages = [];
    const extensionPort = {
      onMessage: {
        addListener: (messageCallback: any) => {
          messageConsumer = messageCallback;
        },
      },
      onDisconnect: {
        addListener: noop,
      },
      postMessage(message: any) {
        messages.push(message);
      },
    };

    const connectionStream = new PortStream(
      extensionPort as unknown as Runtime.Port
    );

    // connect both
    clientSideStream = jsonRpcConnection.stream;
    clientSideStream
      .pipe(connectionStream as unknown as Duplex)
      .pipe(clientSideStream);
  });

  it("retries requests on reconnect message", async () => {
    // request and expected result
    const req1 = { id: 1, jsonrpc, method: "test" };
    const req2 = { id: 2, jsonrpc, method: "test" };
    const res = { id: 1, jsonrpc, result: "test" };

    // Initially sent once
    const responsePromise1 = engineA?.handle(req1);
    // intentionally not awaited
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    engineA?.handle(req2);
    await artificialDelay();

    expect(messages).toHaveLength(2);

    // Reconnected, gets sent again
    messageConsumer({
      jsonrpc,
      method: RECONNECTED,
    });
    await artificialDelay();

    expect(messages).toHaveLength(4);
    expect(messages[0]).toBe(messages[2]);
    expect(messages[1]).toBe(messages[3]);

    messageConsumer(res);

    expect(await responsePromise1).toStrictEqual(res);

    // Handled messages don't get retried but unhandled still do

    messageConsumer({
      jsonrpc,
      method: RECONNECTED,
    });
    await artificialDelay();

    expect(messages).toHaveLength(5);
  });

  it("does not throw error when response is received for request not in map", async () => {
    const res = { id: 1, jsonrpc, result: "test" };

    messageConsumer(res);

    expect(() => {
      messageConsumer(res);
      messageConsumer(res);
    }).not.toThrow();
  });

  it("does not retry if the request has no id", async () => {
    // request and expected result
    const req = { id: undefined, jsonrpc, method: "test" };

    // Initially sent once, message count at 1
    // intentionally not awaited
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    engineA?.handle(req);
    await artificialDelay();
    expect(messages).toHaveLength(1);

    // Reconnected, but request is not re-submitted
    messageConsumer({
      jsonrpc,
      method: RECONNECTED,
    });
    await artificialDelay();
    expect(messages).toHaveLength(1);
  });

  it("throw error when requests are retried more than 3 times", async () => {
    // request and expected result
    const req = { id: 1, jsonrpc, method: "test" };

    // Initially sent once, message count at 1
    // intentionally not awaited
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    engineA?.handle(req);
    await artificialDelay();
    expect(messages).toHaveLength(1);

    // Reconnected, gets sent again message count increased to 2
    messageConsumer({
      jsonrpc,
      method: RECONNECTED,
    });
    await artificialDelay();
    expect(messages).toHaveLength(2);

    // Reconnected, gets sent again message count increased to 3
    messageConsumer({
      jsonrpc,
      method: RECONNECTED,
    });
    await artificialDelay();
    expect(messages).toHaveLength(3);

    // Reconnected, gets sent again message count increased to 4
    messageConsumer({
      jsonrpc,
      method: RECONNECTED,
    });
    await artificialDelay();
    expect(messages).toHaveLength(4);

    // Prepare listener to receive error
    clientSideStream.on("error", (error: Error) => {
      expect(error.message.trim()).toBe(
        'StreamMiddleware - Retry limit exceeded for request id "1"'
      );
    });
    // Reconnected, error is thrown when trying to resend request more that 3 times
    messageConsumer({
      jsonrpc,
      method: RECONNECTED,
    });
  });
});
