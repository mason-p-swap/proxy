# Proxy Swap — project context

Two products in one React app, both live on the **Sepolia** testnet:

- **Exchange** — a Uniswap-v2-style AMM with a smart order router. Routes each swap through
  our own zXMR liquidity pools or Uniswap V2, and supports native ETH (wrap/unwrap via WETH9).
- **Money Market** — a multi-asset lending/borrowing protocol (supply, borrow, collateral,
  interest, liquidations) priced by a Chainlink-backed oracle.

zXMR is the hub asset. See `HANDOFF.md` for every deployed address, the router policy table,
and the remaining zXMR backend work (real token, real price feed, Monero bridge SDK).

## Stack
- Frontend: React + TypeScript + Vite, Tailwind v4, `viem` for chain calls, MetaMask wallet.
- Contracts: Solidity `^0.8.28` with Foundry, in `contracts/`. OpenZeppelin comes from the
  parent project's `node_modules` (see `contracts/foundry.toml` remappings + `allow_paths`),
  so run `npm install` before `forge build`.

## Commands
- `npm install` — install frontend deps (also needed for contract builds).
- `npm run dev` — start the Vite dev server.
- `npm run typecheck` — type-check. Must use the app tsconfig; the npm script already does
  `tsc --noEmit -p tsconfig.app.json` (a bare `tsc --noEmit` checks nothing here).
- `npm run build` — production build.
- `cd contracts && forge test` — full contract test suite (unit + invariants).
- `cd contracts && forge build` — compile contracts.

## Deploys (user-run, never automated)
Deploys and on-chain transactions are broadcast by the project owner using a Foundry
encrypted keystore, not from source. The pattern:
`forge script script/<name>.s.sol --rpc-url <sepolia_rpc> --account <keystore> --sender <owner> --broadcast`
Public Sepolia RPC in use: `https://ethereum-sepolia-rpc.publicnode.com`.
Scripts write and dry-run; the owner reviews and broadcasts. Never put private keys in files.

## Conventions
- **No comments in code** — TS/TSX, CSS, HTML, config, and Solidity. The only exception is
  the `// SPDX-License-Identifier` header required in `.sol` files. Prefer self-explanatory
  names; put explanations in chat/commits/docs, not inline.
- **Theme:** the app ships a cream/peach light theme (Plus Jakarta Sans), defined in
  `index.html`, `src/index.css`, and `src/components/blocks-background.tsx`. This is the
  committed default.
- The money market is an original multi-asset lending implementation.

## No env vars
The app reads no environment variables (RPC is a hardcoded public endpoint; there are no API
keys). There is nothing to configure in a `.env` to run it.
