# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

React (Vite) web app for the AR.IO migration from Arweave/AO to Solana. Users connect their source wallet (Arweave via Wander, or Ethereum via MetaMask/Coinbase), link it to a Solana destination address (Phantom, Solflare, Backpack), and the attestation is permanently stored on Arweave via the Turbo SDK.

## Build & Dev

```bash
yarn install
yarn dev          # Vite dev server on http://localhost:5173
yarn build        # tsc + vite build → dist/
yarn preview      # Serve production build locally
```

No test suite or linter configured. Type-checking is done via `tsc` during build (`noEmit: true`). To type-check without building: `npx tsc`.

## Vite Configuration

- **Path alias**: `@` → `./src` (configured in `vite.config.ts`). Not currently used — all imports use relative paths
- **Base path**: `"./"` (relative) for Arweave subpath deployment compatibility
- **Build-time defines**: `import.meta.env.PACKAGE_VERSION` (from `package.json`) and `import.meta.env.BUILD_TIME` (date-only ISO string) are injected at build time
- **Source maps**: Disabled by default; enable with `VITE_SOURCEMAPS=true`

## Environment Variables

Configured via env vars at build time. All prefixed with `VITE_`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC (used for `getLatestBlockhash` in Ledger fallback). Override with a premium RPC for production. |
| `VITE_ARWEAVE_GATEWAY_URL` | `https://turbo-gateway.com` | Primary Arweave GraphQL gateway |
| `VITE_ARWEAVE_FALLBACK_GATEWAY_URL` | `https://arweave-search.goldsky.com` | Fallback gateway if primary fails |
| `VITE_ARWEAVE_EXPLORER_URL` | `https://turbo-gateway.com` | Block explorer for attestation TX links |
| `VITE_ATTESTATION_APP_NAME` | `AR-IO-Solana-Registration` | Protocol tag on attestation data items |
| `VITE_SNAPSHOT_HOLDINGS_SOURCE` | `/snapshot-holdings.json` | Snapshot holdings JSON: a path, full URL, or 43-char Arweave tx id |

## Architecture

### Routing

Hash-based routing (`#/` and `#/status/:address`) implemented manually in `App.tsx` via `useHashRoute()`. Two pages:
- `RegisterPage` — 5-step wizard for wallet linking
- `StatusPage` — lookup registration status by any address type (auto-detects Arweave/Ethereum/Solana)

### Registration Flow (RegisterPage)

A state machine driven by `RegistrationStep` type (`idle` → `source_connected` → `registration_checked` → `solana_connected` → `address_signed` → `signing` → `confirmed`). Each transition maps to a `StepCard`:

1. **Source wallet connect** — `SourceWalletConnect` tabs between `ArweaveWalletConnect` (Wander `window.arweaveWallet` API) and `EthereumWalletConnect` (EIP-1193 multi-provider detection)
2. **Registration check** — `ExistingRegistrationCheck` queries Arweave GraphQL for prior attestation
3. **Solana wallet connect** — `SolanaWalletConnect` uses `@solana/wallet-adapter-react`. Uniqueness check via `queryAttestationBySolanaPubkey` with stale-mapping cross-check
4. **Solana authorization** — `SourceAddressSigner` signs the source address with Solana wallet. Dual method: `signMessage` (default) with auto-fallback to `signTransaction` (Ledger). See `docs/SIGNATURE_VERIFICATION.md`
5. **Confirm & register** — `RegistrationProgress` calls `useTurboAttestation` hook which uploads an Arweave data item via `TurboFactory.authenticated` (Turbo SDK). Source wallet reconnection required for signing the upload

### Registration Deadline

Registration is blocked after `SNAPSHOT_WINDOW_START` (June 1, 2026 00:00 UTC) in `RegisterPage.tsx`. After this date, the register page shows a "Registration is Closed" banner and hides all step cards.

### Service Layer

- `arweave-graphql.ts` — GraphQL client with primary/fallback gateway pattern, 2-minute TTL cache, three query functions by owner/tag/solana-pubkey. Post-fetch `App-Name` filtering for reliability
- `ao-asset-lookup.ts` — Live AO network asset lookup via `@ar.io/sdk` (`ARIO.mainnet()`). Queries balance, gateway status, delegations, ArNS names, vaults in parallel via `Promise.allSettled`. 5-minute cache + in-flight deduplication. **Note:** currently unused at runtime — `useAOAssetLookup` imports from `snapshot-asset-lookup.ts` instead
- `snapshot-asset-lookup.ts` — Frozen snapshot holdings lookup. Loads a JSON file (from `VITE_SNAPSHOT_HOLDINGS_SOURCE`) once and caches it in-module. Supports lookup by Arweave address, ETH address (case-insensitive via EIP-55 index), or Solana destination address. Returns the same `LiveAssetSummary` shape as the live AO lookup for drop-in compatibility

### Hooks

- `useTurboAttestation` — Manages the Turbo SDK upload lifecycle (create signer → upload → confirm). Handles Arweave (ArconnectSigner) and Ethereum (InjectedEthereumSigner with ethers.js BrowserProvider) paths
- `useAOAssetLookup` — Wraps `lookupSnapshotAssets` (frozen snapshot, not live AO) with React lifecycle (cancellation, loading/error state)
- `useAttestationStatus` — Checks registration: localStorage first (instant for just-registered users), then Arweave GraphQL. Supports retry

### Key Patterns

- **Wallet adapter type shim**: `@solana/wallet-adapter-react` components are cast to `any` in `App.tsx` for React 18/19 type compatibility
- **Dynamic imports**: Turbo SDK, ethers, bs58, `@noble/ed25519` are dynamically imported for tree-shaking
- **Inline styles**: Most component styling uses `React.CSSProperties` objects from `getStyles()` functions. Interactive states (hover/focus), animations, responsive breakpoints, and wallet-adapter overrides live in `styles.css`
- **Brand colors**: Exported from `App.tsx` as `brand` constant. Primary: `#5427C8`, used across all components
- **localStorage persistence**: Registrations cached under `ar-io-registrations`, `ar-io-registered-wallets`, `ar-io-registered-solana` for instant Status page lookups before Arweave indexes

### Signature Verification Protocol

Two methods documented in `docs/SIGNATURE_VERIFICATION.md`:
- **"message"** — Ed25519 `signMessage(sourceAddressBytes)`, verified with `@noble/ed25519`
- **"transaction"** (Ledger fallback) — Memo program instruction with `ar.io-registration:<sourceAddress>`, signed but never submitted. Transaction message stored in `Signature-Data` tag as base64url

**Critical constraints in `SourceAddressSigner.tsx`:**
- The transaction fallback MUST use legacy `Transaction` (not `VersionedTransaction`) — the migration verifier parses the legacy 3-byte header format
- `Signature-Data` uses base64url encoding (`-`, `_` instead of `+`, `/`) because standard base64 `+` chars get corrupted to spaces in the Turbo upload pipeline
- The fallback imports `@solana/web3.js` (legacy API) for `Transaction`/`TransactionInstruction`/`PublicKey`, separate from the main `@solana/kit` v6 dependency used elsewhere

Attestation tags (`App-Name`, `Version`, `Action`, `Source-Address`, `Solana-Pubkey`, `Source-Chain`, `Solana-Signature`, `Signature-Method`, `Timestamp`) are defined in `useTurboAttestation.tsx`.

### Solana SDK Dependency Split

Two Solana SDK packages coexist:
- `@solana/kit` v6 — primary dependency, used for wallet adapter integration
- `@solana/web3.js` — dynamically imported in `SourceAddressSigner.tsx` only, for legacy `Transaction` construction in the Ledger signTransaction fallback

### Polyfills

`vite-plugin-node-polyfills` provides Buffer, crypto, stream, os, util, process, fs for browser compatibility with the multi-chain wallet stack.
