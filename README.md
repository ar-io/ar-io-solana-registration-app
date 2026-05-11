# AR.IO Solana Registration App

A React web application for registering wallet addresses for the AR.IO migration from Arweave AO to Solana. Users link their existing Arweave or Ethereum wallet to a Solana destination address, enabling the migration of ARIO tokens, ArNS names, vaults, and staking positions.

## Quick Start

```bash
yarn install
yarn dev
```

Open `http://localhost:5173`.

## Supported Wallets

| Chain | Wallets |
|-------|---------|
| Solana | Phantom, Solflare, Backpack, and wallet-standard compatible |
| Arweave | Wander (formerly ArConnect) |
| Ethereum | MetaMask, Coinbase Wallet, Trust Wallet |

## Registration Flow

1. Connect your Arweave or Ethereum wallet
2. Check for existing registration
3. Connect your Solana wallet
4. Authorize with Solana signature
5. Confirm & register

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `VITE_ARWEAVE_GATEWAY_URL` | `https://turbo-gateway.com` | Arweave GraphQL gateway |
| `VITE_ARWEAVE_EXPLORER_URL` | `https://viewblock.io/arweave/tx` | Arweave block explorer |

## License

AGPL-3.0-or-later
