## [2.0.0](https://github.com/theQRL/qrl-wallet-provider/compare/v1.0.1...v2.0.0) (2026-11-25)

### ⚠ BREAKING CHANGES

* The provider uses qrl_* RPC methods and 64-byte QRL addresses. The legacy 20-byte Ethereum address utilities have been removed.

* fix: account change event ordering for RPC responses and notifications

- Add version tracking to ensure account changes from RPC
  responses are processed in the correct order relative to
  incoming notifications.
- Introduce `_recordAccountResponse` and `_handleAccountsNotification`
  methods to manage versioning.
- Update `createStreamMiddleware` to support an optional callback
  for tracking responses.

### Features

* migrate provider to QRL 2.0 ([#23](https://github.com/theQRL/qrl-wallet-provider/issues/23)) ([1316fd9](https://github.com/theQRL/qrl-wallet-provider/commit/1316fd95234aa169e8f5dbf64b990411de86f72b))

## [1.0.1](https://github.com/theQRL/qrl-wallet-provider/compare/v1.0.0...v1.0.1) (2026-05-07)

### Bug Fixes

* CIPH-QRLW3-29-31 ([#10](https://github.com/theQRL/qrl-wallet-provider/issues/10)) ([ad2cbb4](https://github.com/theQRL/qrl-wallet-provider/commit/ad2cbb40f229c9a726845378b336d04a9dcae10f))

## [1.0.0](https://github.com/theQRL/qrl-wallet-provider/compare/v0.1.1...v1.0.0) (2026-05-02)

### ⚠ BREAKING CHANGES

* zond -> qrl

### Features

* zond -> qrl ([dbeaa65](https://github.com/theQRL/qrl-wallet-provider/commit/dbeaa656d454cd109cd8b9ad32abd4ee1920dfc2))
