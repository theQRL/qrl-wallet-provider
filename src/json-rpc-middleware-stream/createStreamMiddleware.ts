import { Duplex } from "readable-stream";
import type {
  JsonRpcEngineEndCallback,
  JsonRpcMiddleware,
} from "../json-rpc-engine";
import SafeEventEmitter from "../safe-event-emitter";
import type {
  Json,
  JsonRpcId,
  JsonRpcNotification,
  JsonRpcParams,
  JsonRpcRequest,
  JsonRpcResponse,
  PendingJsonRpcResponse,
} from "../utils";
import { hasProperty, isJsonRpcNotification, isJsonRpcResponse } from "../utils";

type IdMapValue = {
  req: JsonRpcRequest;
  res: PendingJsonRpcResponse<Json>;
  end: JsonRpcEngineEndCallback;
  retryCount?: number;
};


type Options = {
  retryOnMessage?: string;
  onResponseReceived?: (
    request: JsonRpcRequest,
    response: PendingJsonRpcResponse<Json>,
  ) => void;
};

function validateMessage(
  value: unknown,
): JsonRpcResponse<Json> | JsonRpcNotification | undefined {
  if (!value || typeof value !== "object" || !hasProperty(value, "jsonrpc")) {
    return undefined;
  }

  try {
    if (hasProperty(value, "id")) {
      const hasResult = hasProperty(value, "result");
      const hasError = hasProperty(value, "error");
      return hasResult !== hasError && isJsonRpcResponse(value) ? value : undefined;
    }

    if (
      hasProperty(value, "method") &&
      isJsonRpcNotification(value) &&
      value.method.length > 0
    ) {
      return value;
    }
  } catch {
    // Structured-clone transports can carry values that are not JSON, including cycles.
  }
  return undefined;
}

/**
 * Creates a JsonRpcEngine middleware with an associated Duplex stream and
 * EventEmitter. Incoming messages are validated before they reach the engine.
 *
 * @param options - Configuration options for middleware.
 * @returns The event emitter, middleware, and stream.
 */
export default function createStreamMiddleware(options: Options = {}) {
  const pendingRequests = new Map<JsonRpcId, IdMapValue>();
  const stream = new Duplex({
    objectMode: true,
    read: () => undefined,
    write: processMessage,
  });

  const events = new SafeEventEmitter();

  const middleware: JsonRpcMiddleware<JsonRpcParams, Json> = (
    req,
    res,
    _next,
    end,
  ) => {
    // register request on id map *before* sending it to the stream, to avoid race issues
    pendingRequests.set(req.id, { req, res, end });
    // write req to stream
    sendToStream(req);
  };

  return { events, middleware, stream };

  /**
   * Forwards JSON-RPC request to the stream.
   *
   * @param req - The JSON-RPC request object.
   */
  function sendToStream(req: JsonRpcRequest) {
    stream.push(req);
  }

  /**
   * Writes a JSON-RPC object to the stream.
   *
   * @param res - The JSON-RPC response object.
   * @param _encoding - The stream encoding, not used.
   * @param streamWriteCallback - The stream write callback.
   */
  function processMessage(
    res: unknown,
    _encoding: unknown,
    streamWriteCallback: (error?: Error | null) => void,
  ) {
    let errorObj: Error | null = null;
    try {
      const message = validateMessage(res);
      if (message) {
        if ("id" in message) {
          processResponse(message);
        } else {
          processNotification(message);
        }
      }
    } catch (_err) {
      errorObj = _err as Error;
    }
    // continue processing stream
    streamWriteCallback(errorObj);
  }

  /**
   * Processes a JSON-RPC response.
   *
   * @param res - The response to process.
   */
  function processResponse(res: JsonRpcResponse<Json>) {
    const responseId = res.id;
    const context = pendingRequests.get(responseId);
    if (!context) {
      console.warn(`StreamMiddleware - Unknown response id "${responseId}"`);
      return;
    }

    pendingRequests.delete(responseId);
    if ("error" in res) {
      context.res.error = res.error;
    } else {
      context.res.result = res.result;
    }
    options.onResponseReceived?.(context.req, context.res);
    // run callback on empty stack,
    // prevent internal stream-handler from catching errors
    setTimeout(context.end);
  }

  /**
   * Processes a JSON-RPC notification.
   *
   * @param notif - The notification to process.
   */
  function processNotification(notif: JsonRpcNotification) {
    if (options?.retryOnMessage && notif.method === options.retryOnMessage) {
      retryStuckRequests();
    }
    events.emit("notification", notif);
  }

  /**
   * Retry pending requests.
   */
  function retryStuckRequests() {
    pendingRequests.forEach((context) => {
      const { req, retryCount = 0 } = context;
      // An absent or null ID cannot reliably correlate a retried request.
      if (req.id === null || req.id === undefined) {
        return;
      }

      if (retryCount >= 3) {
        throw new Error(
          `StreamMiddleware - Retry limit exceeded for request id "${req.id}"`,
        );
      }

      context.retryCount = retryCount + 1;
      sendToStream(req);
    });
  }
}
