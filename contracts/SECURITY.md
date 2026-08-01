# Security

**This code is unaudited and testnet-only. Do not deploy it to a live network
or use it with real funds.** A money market is one of the most attacked contract
types in crypto; safe mainnet use would require multiple independent
professional audits, formal verification of the core accounting, a public
bug-bounty program, and a capped, monitored rollout. None of that has happened
here. What follows is an honest description of the current posture, not a claim
of safety.

## Threat model & mitigations

| Class | Status |
|---|---|
| Oracle price manipulation (flash-loan spot attacks) | Mitigated — prices come from Chainlink data feeds, not manipulable on-chain spot sources. |
| Reentrancy | Mitigated — `ReentrancyGuard` on all state-changing entry points, checks-effects-interactions ordering, `SafeERC20`. |
| Share-inflation / donation attack | Not applicable — balances track scaled amounts against interest indexes, not the contract's token balance, so direct transfers can't move the exchange rate. Sub-unit deposits that would round to zero shares revert. |
| Stale interest in solvency checks | Mitigated — health-factor, borrow-power and balance views project every reserve's index to the current block, so accrued interest on untouched reserves is counted. |
| Stale / frozen / incomplete oracle rounds | Partially mitigated — the oracle rejects non-positive answers and incomplete rounds, and supports a configurable staleness bound. The bound must be set per feed heartbeat in production (currently disabled for testnet feed reliability). |
| Integer overflow | Mitigated — Solidity 0.8 checked arithmetic. |
| Bad debt from under-water liquidations | Bounded — liquidation caps seizure at the borrower's collateral and lets the shortfall remain as bad debt rather than reverting, so positions never become unliquidatable. |

## Trust assumptions (by design here, must change for production)

- **Owner is fully trusted.** The owner can list/reconfigure reserves, change
  risk parameters (which can retroactively affect open positions), pause, and
  set the oracle. A production deployment must place these behind a timelock and
  multisig, or renounce them.
- **Oracle owner override.** The oracle exposes a manual price override so
  liquidations can be demonstrated on testnet. This is a total control over
  solvency and **must not exist** in a production oracle.
- **Curated asset list.** Only the owner lists reserves. The accounting assumes
  standard ERC-20 behaviour; **fee-on-transfer and rebasing tokens are not
  supported** and must never be listed.

## Known simplifications vs a production protocol

- Interest accrues linearly per accrual rather than compounding per second.
- Supply and debt positions are internal balances, not transferable tokens.
- No flash loans, isolation mode, or efficiency mode.
- Prices assume 8-decimal feeds/pegs; stablecoins are pegged to $1 rather than
  read from a feed.

## Testing

`forge test` — 65 tests including fuzz tests over supply/withdraw/borrow/repay
value conservation, adversarial liquidation cases, rate-curve behaviour, and
oracle failure modes. Passing tests are necessary but not sufficient evidence of
safety.

## Before any mainnet consideration

1. Independent professional audit(s).
2. Timelock + multisig on all privileged functions; remove the oracle override.
3. Per-feed staleness bounds and, on L2s, a sequencer-uptime check.
4. Formal verification of the index/interest accounting.
5. Public bug bounty and a capped, monitored deployment.
