const messages = {
  errors: {
    disconnected: () =>
      "QrlWallet: Disconnected from chain. Attempting to connect.",
    permanentlyDisconnected: () =>
      "QrlWallet: Disconnected from QrlWallet background. Page reload required.",
    sendSiteMetadata: () =>
      `QrlWallet: Failed to send site metadata. This is an internal error, please report this bug.`,
    unsupportedSync: (method: string) =>
      `QrlWallet: The QRL wallet provider does not support synchronous methods like ${method} without a callback parameter.`,
    invalidDuplexStream: () => "Must provide a Node.js-style duplex stream.",
    invalidNetworkParams: () =>
      "QrlWallet: Received invalid network parameters. Please report this bug.",
    invalidRequestArgs: () => `Expected a single, non-array, object argument.`,
    invalidRequestMethod: () => `'args.method' must be a non-empty string.`,
    invalidRequestParams: () =>
      `'args.params' must be an object or array if provided.`,
    invalidLoggerObject: () => `'args.logger' must be an object if provided.`,
    invalidLoggerMethod: (method: string) =>
      `'args.logger' must include required method '${method}'.`,
  },
  info: {
    connected: (chainId: string) =>
      `QrlWallet: Connected to chain with ID "${chainId}".`,
  },
  warnings: {
    // deprecated methods
    sendDeprecation: `QrlWallet: 'provider.send(...)' is deprecated and may be removed in the future. Please use 'provider.sendAsync(...)' or 'provider.request(...)' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193`,
    // deprecated events
    events: {
      close: `QrlWallet: The event 'close' is deprecated and may be removed in the future. Please use 'disconnect' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193#disconnect`,
      data: `QrlWallet: The event 'data' is deprecated and will be removed in the future. Use 'message' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193#message`,
      networkChanged: `QrlWallet: The event 'networkChanged' is deprecated and may be removed in the future. Use 'chainChanged' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193#chainchanged`,
      notification: `QrlWallet: The event 'notification' is deprecated and may be removed in the future. Use 'message' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193#message`,
    },
    rpc: {
      walletWatchAssetNFTExperimental: `QrlWallet: The RPC method 'wallet_watchAsset' is experimental for ERC721/ERC1155 assets and may change in the future.`,
    },
    // misc
    experimentalMethods: `QrlWallet: 'provider._qrlWallet' exposes non-standard, experimental methods. They may be removed or changed without warning.`,
  },
};
export default messages;
