# Proxy Swap

A crypto exchange frontend with a real, on-chain lending protocol behind it.
Live on the **Sepolia testnet** — unaudited, educational, testnet-only code.

## What's inside

**Instant swapper** — cross-chain swaps via a third-party swap API: live
quotes, address validation, real order creation and status tracking.

**Money market** — a multi-asset pooled lending protocol:

- Four reserves (WETH / DAI / USDC / USDT), each suppliable and borrowable
- Scaled-balance accounting with per-reserve liquidity & borrow indexes
- Portfolio-wide health factor, weighted by per-asset liquidation thresholds
- LTV-based borrow power, per-user collateral toggles
- Cross-asset liquidations (close factor 50%, per-asset bonus)
- Kinked interest-rate curves per reserve, reserve factor to treasury
- Foundry test suite, including fuzz tests

**App** — React + viem frontend: markets overview, personal dashboard
(net worth, position shape, health factor), dedicated Supply / Borrow pages,
MetaMask flows with approve-then-act, and live on-chain rate-curve charts.

## Deployed contracts (Sepolia)

All source-verified on [Blockscout](https://eth-sepolia.blockscout.com).

| Contract | Address |
|---|---|
| MoneyMarket | `0xd0f6a8fddc8b92553896e4525b842b57b266e94e` |
| Price oracle (settable, demo) | `0x19ec82b51c672f56fe8c2a775c87a7d1bcaf16bb` |
| WETH (test, open faucet) | `0xb19ac01ca95974bbbefce4e57f8c2f6e3c234360` |
| DAI (test, open faucet) | `0x88e8ba943d04b2de1b1c7e1a2b84e501d90333e1` |
| USDC (test, open faucet) | `0x335ff97061154bf5372efb8c0b9b57f944279994` |
| USDT (test, open faucet) | `0xa9ca2f149747ceb21a9ae707cb0a4380dba3ee02` |
| LendingPool v1 (isolated pair) | `0x08baf060638af6069bce0809f445f7575fa86ae1` |

## Run the app

```bash
npm install
cp .env.example .env   # optional: add a swap API key to enable live swaps
npm run dev            # http://localhost:5173
```

The lending pages work read-only with no wallet; install MetaMask on Sepolia
to supply and borrow. Every test token has a faucet button in the app.

Dev tip: append `?mockwallet` to the URL to preview the connected UI with a
read-only fake wallet.

## Contracts

```bash
cd contracts
forge test
forge build
```

Deploying uses a Foundry **encrypted keystore** — no private keys in files:

```bash
cast wallet import <name> --interactive
forge script script/DeployMoneyMarket.s.sol \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --account <name> --broadcast
```

## Limitations

- Unaudited. Never deploy to mainnet or put real funds in it.
- The oracle is owner-settable by design (it makes liquidation demos
  possible); a production deployment would use decentralized price feeds.
- Interest accrues linearly; supply/debt positions are internal balances
  rather than transferable tokens.
