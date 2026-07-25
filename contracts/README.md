# Proxy Swap — Lending Contracts

> ⚠️ **Unaudited, educational code. Testnet only.** Do not deploy to mainnet or
> put real funds in it.

## What's here

| File | Purpose |
| --- | --- |
| `src/MoneyMarket.sol` | Multi-asset pooled lending market: supply, withdraw, borrow, repay, collateral toggles, cross-asset liquidations, utilization-based interest, reserve factor, caps, pause. |
| `src/LendingPool.sol` | The original isolated two-asset market (single collateral → single loan asset). Kept as the first deployment. |
| `src/SettablePriceOracle.sol` | Test oracle whose prices are set by hand. Lets you move prices and watch liquidations fire. **Not for production.** |
| `src/interfaces/IPriceOracle.sol` | Oracle interface, so the mock can later be swapped for a production feed adapter. |
| `src/mocks/` | Open-faucet test tokens (18- and 6-decimal). |
| `script/DeployMoneyMarket.s.sol` | Sepolia deployment: tokens, oracle, market, four listed reserves. |
| `test/` | Foundry suites, including fuzz tests. |

## Running

```bash
forge build
forge test -vv
forge test --gas-report
```

OpenZeppelin is installed via npm in the parent project (`../node_modules`), so
run these from this `contracts/` directory.

## Deploying

Uses a Foundry encrypted keystore — no private keys in files:

```bash
cast wallet import <name> --interactive
forge script script/DeployMoneyMarket.s.sol \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --account <name> --broadcast
```
