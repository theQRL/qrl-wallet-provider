import type { JsonRpcMiddleware } from "../../json-rpc-engine";
import type { Json, JsonRpcParams, JsonRpcRequest } from "../../utils";

import { ERC1155, ERC721 } from "../constants";
import messages from "../messages";
import type { ConsoleLike } from "../utils";

/**
 * Create JSON-RPC middleware that logs a warning for experimental NFT asset tracking.
 *
 * @param log - The logging API to use.
 * @returns The JSON-RPC middleware.
 */
export function createRpcWarningMiddleware(
  log: ConsoleLike,
): JsonRpcMiddleware<JsonRpcParams, Json> {
  let warnedAboutNftTracking = false;

  return (req, _res, next) => {
    if (
      !warnedAboutNftTracking &&
      req.method === "wallet_watchAsset" &&
      [ERC721, ERC1155].includes(
        (req as JsonRpcRequest<{ type: string }>).params?.type || "",
      )
    ) {
      log.warn(messages.warnings.rpc.walletWatchAssetNFTExperimental);
      warnedAboutNftTracking = true;
    }
    next();
  };
}
