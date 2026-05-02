# Security Policy

## Reporting Vulnerabilities

Please report security vulnerabilities to **security@theqrl.org**.

Do not open public issues or pull requests for security vulnerabilities.

## Supported Versions

Until `qrl-wallet-provider` reaches `1.0.0`, only the latest published `0.x` minor is supported. Once `1.0.0` ships, the most recent two majors will receive security fixes.

| Version | Supported |
|---------|-----------|
| 0.x (latest) | Yes |
| < 0.x (older) | No  |

---

## Threat Model

`qrl-wallet-provider` is a **transport layer**, not a key-handling layer. The provider does not generate, store, or operate on private keys. It is the JSON-RPC channel that carries dApp requests to the wallet extension and carries responses back.

The library bundles modules derived from MetaMask's `providers`, `json-rpc-engine`, `json-rpc-middleware-stream`, `object-multiplex`, `post-message-stream`, `rpc-errors`, `safe-event-emitter`, `superstruct`, and `utils`. Sub-licenses for each are preserved in the corresponding directory under `src/`.

### Trust Boundaries

```
[ dApp page (untrusted) ]
        │  window.postMessage (origin: same-origin to the page)
        ▼
[ in-page provider (this repo) ]
        │  window.postMessage
        ▼
[ extension content script ]
        │  chrome.runtime.connect (Port)
        ▼
[ extension background / service worker ]
        │  in-extension function call
        ▼
[ wallet (key custody — out of scope for this repo) ]
```

Every boundary above is a trust boundary. The provider's job is to:

1. **Frame** dApp requests as JSON-RPC envelopes with unique IDs.
2. **Route** them through `object-multiplex` substreams so unrelated traffic on the same `Port` is isolated.
3. **Match** responses back to the originating request by ID, with no cross-talk.
4. **Validate** inbound messages against `superstruct` schemas before acting on them.
5. **Surface** the EIP-6963 announcement so the dApp can discover the wallet without monkey-patching `window.ethereum`.

### Out of Scope

- Private key generation, storage, or signing — handled by the wallet extension.
- Network RPC against QRL nodes — the wallet relays these.
- DApp-side input validation — the dApp must validate user input before calling the provider.
- Phishing UX — handled by the wallet extension's confirmation flow.

### In Scope

- JSON-RPC framing and serialization.
- Substream demultiplexing.
- Origin / source checks on `window.postMessage`.
- Schema validation on inbound messages.
- EIP-1193 conformance (`request`, `on`, event semantics).
- EIP-6963 conformance (`announceProvider`, `requestProvider`).
- Memory hygiene — no caching of request payloads beyond the lifetime of the in-flight RPC.

---

## Known Security Considerations

### `WindowPostMessageStream` origin checks

`window.postMessage` listeners must check `event.source === window` (same-window only) and the expected `name` field on the envelope. A page that runs scripts from third-party origins can post messages to itself; the stream relies on the substream name and `superstruct` validation to reject malformed traffic. Consumers should not extend the stream-name namespace without understanding this.

### EIP-6963 detection

`isQrlWallet: true` is the dApp-side detection flag. dApps that do feature detection on `window.ethereum.isQrlWallet` will see `true` after the provider initializes. dApps that use the EIP-6963 announce/request handshake see the provider's `info` object including `uuid`, `name`, `icon`, `rdns`. The `uuid` is generated fresh per page load by the consumer; the `rdns` should match the actual extension's reverse DNS.

### Request-ID matching

JSON-RPC request IDs must be unique per stream instance for the lifetime of an in-flight request. The bundled `json-rpc-engine` uses an integer counter; collisions in long-lived pages with high request volume would result in cross-talk. Consumers that mint very high volumes of requests should monitor for ID exhaustion.

### MetaMask upstream divergence

This repository was forked from MetaMask's libraries. Diverged code paths are the primary novel attack surface. Audit reviewers should diff against the upstream commits at the time of fork and triage every divergence.

---

## Dependencies

Runtime dependencies are documented in `package.json`. Cryptographic operations are not performed by this library; signing happens in the wallet extension. The `@noble/hashes` and `@scure/base` packages are used only where MetaMask upstream uses them (utilities, address checksumming, etc.) and inherit those packages' constant-time guarantees.

> **Note:** Several packages currently listed under `devDependencies` are in fact runtime dependencies and should be moved to `dependencies` before the next publish. This is tracked in the production-readiness checklist.

---

## Naming

The package is published as `@theqrl/qrl-wallet-provider`. The repository was historically named `zond-wallet-provider`; the runtime API surface (`QrlWalletInpageProvider`, `isQrlWallet`, `qrlWallet_*` RPC methods, `QRL_WALLET_*` wire messages) was migrated in lockstep with the only first-party consumer (`qrl-web3-wallet`). There is no backward-compat shim — consumers must update their imports to the new package name and class identifiers.

---

## Supply Chain

Releases are (will be) published with:

- **npm provenance** — `npm publish --provenance`
- **SBOM** — SPDX and CycloneDX, attested via `actions/attest-sbom@v4`
- **SLSA Level 3 provenance** — via `slsa-framework/slsa-github-generator`
- **Sigstore attestations** — for checksums, package files, and the npm tarball
- **`npm audit signatures`** — hard check in the release workflow

Verify a published release with:

```bash
npm audit signatures
gh attestation verify "$(npm pack @theqrl/qrl-wallet-provider --dry-run --json | jq -r '.[0].filename')" --owner theQRL
```

---

## Audit Status

Initial audit pending. This file will be updated with findings, remediations, and the audit report URL once complete.
