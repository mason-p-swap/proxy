# Proxy Swap — Smart Contract Security Audit Report

> Method: 4 parallel specialist auditors (AMM invariants · money-market accounting ·
> liquidation/oracle · access-control/reentrancy) at high effort across all 6 core contracts,
> then adversarial verification of every finding. 23 raw → 12 confirmed (0 critical, 0 high).

## Remediation status

> **Update after second audit pass (Fable 5 Max):** a deeper 6-specialist pass re-audited the
> three fixes below. It confirmed **MM-02 and ORACLE-02 correct and complete**, and caught that
> the first MM-01 fix (checking health *unconditionally*) introduced a liveness regression:
> every withdrawal — even by a debt-free supplier — ran the full oracle price scan, so a stale
> feed on any held asset could block unrelated withdrawals. **MM-01 has been refined** to gate
> the health check on a cheap, oracle-free "does this user have any debt" scan, matching the
> original intent. Debt-free suppliers no longer touch the oracle on withdraw; a borrower whose
> collateral flag was flipped is still caught. Regression-tested; suite now 94/94 green. The
> second pass surfaced no new critical/high issues. Full detail: `AUDIT_REPORT_PASS2.md`.

**Fixed in source (regression-tested, 94/94 tests pass):**
- **MM-01** — `withdraw()` now checks health whenever the user has debt (via an oracle-free
  `_hasDebt` scan), regardless of the reserve's collateral flag — and skips the price scan
  entirely for debt-free suppliers. (`MoneyMarket.sol`)
- **MM-02** — `_validateConfig` now rejects any collateral config where
  `liqThreshold × (1 + liqBonus) ≥ 1`, so a listed collateral can always be liquidated back to
  health. (`MoneyMarket.sol`)
- **ORACLE-02** — a `maxStaleness` of 0 no longer disables the freshness check; aggregator
  answers are always bounded by `DEFAULT_MAX_STALENESS` (24h) when no custom bound is set.
  (`ChainlinkPriceOracle.sol`)

**Documented, not code-changed (design decisions / accepted limitations):**
- **ORACLE-01 / liquidation DoS** — a genuinely frozen feed reverts portfolio health, which
  blocks liquidation of holders of that asset. Fully isolating per-asset pricing in the
  liquidation path is a larger refactor; deferred and flagged for the mainnet hardening pass.
- **MM-03 / ORACLE-03 / AMM-01..03** — fee-on-transfer & rebasing tokens unsupported (do not
  list them), high-decimal feed truncation (real Chainlink feeds are 8-decimal), and the AMM
  info notes (standard Uniswap-V2 `skim` behavior, cosmetic event index).

> These fixes are in the repo; the live Sepolia contracts still run the pre-fix bytecode.
> They take effect on the next deploy (see `HANDOFF.md` → Before mainnet).

## 1. Executive Summary

Scope: the Proxy Swap contracts on Sepolia (Uniswap-v2-style AMM + multi-asset money market), targeting mainnet. This report covers the adversarially-verified findings only.

**Overall posture:** No critical or high-severity, attacker-triggerable fund-theft vector was confirmed. The dominant risk theme is **oracle robustness and money-market configuration safety** — several confirmed issues let honest-but-routine owner actions or ordinary external events (a Chainlink feed freezing) convert healthy state into unrecoverable bad debt. The most important single fact: the deployed oracle is constructed with `maxStaleness = 0`, so the staleness check that the contract defines is **dead code in production today**. Two money-market findings (collateral-toggle withdrawal, missing liquidation-cure invariant) are genuine accounting gaps that should be fixed before mainnet. The AMM is a faithful Uniswap-V2 fork; its findings are informational/compatibility notes.

**Counts (after consolidating duplicate submissions):**

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 4 | MM-01, MM-02, ORACLE-01, ORACLE-02 |
| Low | 2 | MM-03, ORACLE-03 |
| Info | 3 | AMM-01, AMM-02, AMM-03 |

*Note on consolidation:* the source set contained 12 entries; three pairs were the same defect submitted twice (the portfolio-wide stale-feed liquidation DoS at lines 502 and 533; the `maxStaleness==0` issue rated both medium and low; and the fee-on-transfer money-market accounting issue at line 238). They are merged below into ORACLE-01, ORACLE-02, and MM-03 respectively. No findings were added or dropped.

---

## 2. Confirmed Findings

### MM-01 — `withdraw()` skips the health check when the reserve's collateral flag is off, enabling debt-free collateral extraction
**Severity:** Medium · **File:** `contracts/src/MoneyMarket.sol:262`

**What it is.** In `withdraw()`, the `WouldBreakHealth` guard (lines 263–264) runs only inside `if (_isCollateral(asset, msg.sender))` (line 262). `_isCollateral` is `configOf[asset].collateral && !collateralDisabled[asset][user]` (576–578). The *per-user* disable path (`setUseAsCollateral`) is safe because it pre-checks HF ≥ WAD before flipping the flag. But the *reserve-level* flag `configOf[asset].collateral` can be set false by the owner via `configureReserve` (139–145) with **no per-user health check**. Once false, `_isCollateral` returns false for every holder, the entire health block in `withdraw` is skipped, and the asset also stops counting as collateral in `_portfolio` — so a borrower's HF collapses *and* the guard that would catch it is bypassed. As a compounding effect, `liquidate` (340) then reverts with `NotCollateral`, so the resulting bad debt can never be recovered.

**Concrete exploit.** WETH reserve: collateral=true, LTV 80%, liqThreshold 82.5%. Alice supplies 1 WETH ($3500), borrows 2500 USDC (HF ≈ 1.155). Owner later phases WETH out as collateral: `configureReserve(WETH, cfg with collateral=false)` — a routine risk action. Now `_isCollateral(WETH, alice)` is false. Alice calls `withdraw(WETH, type(uint256).max)`: line 262 is false, the HF check never runs, she receives all 1 WETH while still owing 2500 USDC against zero collateral. She cannot be liquidated. Repeatable across every borrower of that reserve.

**Fix.** Make the solvency check unconditional whenever the user carries debt — do not gate it on the current collateral flag:
```solidity
// after burning scaled shares in withdraw():
if (debtBalanceOf(msg.sender) != 0 && healthFactor(msg.sender) < WAD) {
    revert WouldBreakHealth();
}
```

---

### MM-02 — `_validateConfig` never relates `liqThreshold` to `liqBonus`, so a reserve can be configured where liquidation never cures (and worsens) health
**Severity:** Medium · **File:** `contracts/src/MoneyMarket.sol:181`

**What it is.** `_validateConfig` (181–189) bounds `liqThresholdBps ≤ BPS` and `liqBonusBps ≤ BPS` independently but never enforces a relationship. Liquidation seizes `repayUsd * (BPS + bonus) / BPS` (line 359). For an underwater position, a partial liquidation raises HF only if `threshold * (1 + bonus) < 1`. If a reserve is configured so that `liqThresholdBps * (BPS + liqBonusBps) ≥ BPS * BPS`, every liquidation removes collateral value faster than debt, so HF stays flat or falls — each liquidation deepens insolvency. The test suite only uses safe defaults (8250 × 10500 = 8.66e7 < 1e8), so the missing invariant is invisible.

**Concrete exploit.** Owner configures collateral C with `liqThresholdBps=9500`, `liqBonusBps=1000` (both individually legal; 9500 × 11000 = 1.045e8 > 1e8). Borrower has $980 of C, $940 debt → HF = 980×0.95/940 = 0.990 (liquidatable). Liquidator repays 50% ($470), seizes $470×1.10 = $517. New state: collateral $463, debt $470, HF = 463×0.95/470 = 0.936 — strictly **worse**. Liquidators keep extracting the bonus each round while the position sinks, leaving the reserve with bad debt.

**Fix.** Enforce the cure invariant in `_validateConfig` for collateral reserves:
```solidity
if (cfg.collateral) {
    require(
        uint256(cfg.liqThresholdBps) * (BPS + cfg.liqBonusBps) < BPS * BPS,
        "liq params cannot cure"
    );
}
```

---

### ORACLE-01 — A single stale/reverting feed on any asset in a borrower's portfolio bricks liquidation (oracle-DoS → bad debt)
**Severity:** Medium · **File:** `contracts/src/MoneyMarket.sol:502` (also 523, 533)

**What it is.** `_portfolio` (502–538) loops **every** reserve in which the user has any `scaledSupply` or `scaledDebt` and calls `oracle.getPrice(asset)` (523 collateral branch, 533 debt branch). `ChainlinkPriceOracle.getPrice` (73–93) reverts on `NotConfigured`, `InvalidAggregatorPrice`, `IncompleteRound`, or `StalePrice`. `healthFactor` (466–470) is built on `_portfolio`, and `liquidate` (333–387) calls `healthFactor(user)` at line 344 before any work. So one failing feed — on *any* held asset, even an irrelevant dust position — reverts the whole health computation and blocks liquidation of the entire position, including the sound debt/collateral pair the liquidator is actually targeting. There is no delisting function (the asset stays in the loop forever) and no fallback/last-good-price path; the only escape is a manual owner override.

**Concrete exploit.** Alice supplies sound WETH plus a dust amount of asset B (collateral-enabled), borrows USDC. B's Sepolia Chainlink feed stops updating past `maxStaleness`. `getPrice(B)` reverts `StalePrice`. WETH then falls, pushing Alice below HF 1. Any `liquidate(alice, USDC, WETH, amount)` reaches `healthFactor → _portfolio`, hits B, and reverts. Alice cannot be liquidated on her sound WETH/USDC pair; the position decays into unrecoverable bad debt until the owner pushes an override for B.

**Fix.** Isolate per-asset pricing failures in the liquidation path: let the liquidator name the debt/collateral pair and price only those (with a conservative best-effort health estimate that skips unpriceable positions), or add an emergency-liquidation path that tolerates individual feed failures instead of reverting the whole portfolio scan. A last-good-price fallback in the oracle would also mitigate.

---

### ORACLE-02 — Staleness check is disabled when `maxStaleness == 0`, and the deployed oracle is constructed with 0
**Severity:** Medium · **File:** `contracts/src/ChainlinkPriceOracle.sol:84`

**What it is.** The guard is `if (maxStaleness != 0 && block.timestamp - updatedAt > maxStaleness) revert StalePrice(...)` (line 84). When `maxStaleness == 0` the staleness branch is skipped entirely; the only remaining freshness guards (L82 `answer <= 0`, L83 `updatedAt == 0 || answeredInRound < roundId`) all pass for a feed frozen at a positive price in a completed round. `maxStaleness` has no minimum in the constructor (35–37) or `setMaxStaleness` (68–71). **This is not hypothetical:** `script/UpgradeToChainlink.s.sol:20` constructs `new ChainlinkPriceOracle(0)` and never calls `setMaxStaleness`, then (L21) wires WETH — the only aggregator-priced asset — to the live Sepolia ETH/USD feed (`0x694AA1769357215DE4FAC081bf1f309aDC325306`) and installs the oracle into the live MoneyMarket (L32). The `StalePrice` revert is dead code in production.

**Concrete exploit.** ETH/USD feed freezes at $4,000 (deprecation, round stall) while ETH's true value drops. `getPrice(WETH)` reaches L84 with `maxStaleness==0`, skips the staleness revert, passes L82/L83 (frozen round still has answer>0, updatedAt!=0, answeredInRound≥roundId), and returns $4,000. MoneyMarket's health/liquidation math (L452, L523, L533, L358–367) values WETH collateral at the stale price — the borrower over-borrows or dodges liquidation and the protocol accrues bad debt, with no code path able to reject the quote.

*(DAI/USDC/USDT use `setFixedPrice` and are immune; the exposure is WETH only. This bounds it to medium rather than high, together with the testnet/no-real-funds context. The stablecoin exposure and testnet context are the only reasons it is not higher.)*

**Fix.** Reject 0 and always apply the freshness check:
```solidity
constructor(uint256 maxStaleness_) { require(maxStaleness_ != 0); ... }
function setMaxStaleness(uint256 v) external onlyOwner { require(v != 0); maxStaleness = v; }
```
And redeploy/reconfigure the live oracle with a sane bound (e.g. the ETH/USD feed's heartbeat + margin). Treat `0` as "always stale," never "never stale."

---

### MM-03 — Scaled accounting assumes exact-transfer ERC20s; fee-on-transfer / rebasing reserves corrupt shares and debt
**Severity:** Low · **File:** `contracts/src/MoneyMarket.sol:238` (also 306–317, 378–383)

**What it is.** `supply()` (238–243) mints scaled shares for the full stated `amount` **before** `safeTransferFrom`, with no `balanceBefore/After` reconciliation. `repay()` cuts scaled debt from `amount` before pulling it; `liquidate()` reduces debt for `repayAmount` before receiving it. For a fee-on-transfer token the contract credits more than it receives; for a negatively-rebasing token, held balances shrink with no accounting update. Either way the solvency invariant `cash + borrowed >= supplied` breaks and the reserve trends insolvent, so late withdrawers eventually cannot be paid. Note: this is **not a profitable siphon** — the fee burns on both legs, so the attacker is net-negative; the realistic outcome is protocol insolvency/DoS for that reserve, and the last withdrawer eats the shortfall.

**Trigger / gating.** Fully gated by `listReserve` being `onlyOwner` (117). Current/intended reserves (WETH/DAI/USDC/USDT, standard WETH9) are exact-transfer safe. This is a **listing-time hazard / unsupported-token limitation**, not an unprivileged live exploit — hence low. Relevant because zXMR is slated to become a "real token."

**Fix.** Credit the measured delta, or restrict listings to a vetted allowlist and document the assumption:
```solidity
uint256 before = IERC20(asset).balanceOf(address(this));
IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
uint256 received = IERC20(asset).balanceOf(address(this)) - before;
// use `received` for all share/debt math
```

---

### ORACLE-03 — Decimal scaling can truncate a high-decimal answer to 0 → price=0 mis-valuation and divide-by-zero DoS
**Severity:** Low · **File:** `contracts/src/ChainlinkPriceOracle.sol:98`

**What it is.** `_scale()` floor-divides when `aggregatorDecimals > 8`: `price / 10**(fromDecimals-8)` (line 98). The `answer <= 0` guard (82) runs **pre-scale**, so a small answer that scales to 0 is not caught, and there is no post-scale zero check. `getPrice` can return 0. In MoneyMarket, `_toUsd` (585) then silently values the asset at 0 (understating borrow power / making holders wrongly liquidatable), and `_fromUsd` (589) divides by price → `Panic(0x12)`, reverting `liquidate()`/`borrow()` paths that reference the asset.

**Trigger / gating.** Requires the owner to configure a feed with >8 decimals (e.g. an 18-decimal ETH-denominated feed) reporting a per-unit answer below `10**(fromDecimals-8)`. Not attacker-controllable; standard 8-decimal USD feeds take the exact-equality branch (96) and are unaffected. Hence low.

**Fix.** Revert on a zero scaled result, and prefer scaling by multiplication into higher internal precision before truncating:
```solidity
uint256 scaled = _scale(uint256(answer), aggregatorDecimals);
if (scaled == 0) revert InvalidAggregatorPrice();
```

---

### AMM-01 — Pair/Router assume standard ERC20; fee-on-transfer or rebasing pair tokens revert swaps
**Severity:** Info · **File:** `contracts/src/amm/Pair.sol:104`

**What it is.** `Pair.swap` (104–116) infers `amountIn` from balance deltas and enforces the K-invariant; `Router.getAmountsOut/getAmountOut` (74–99) precompute exact outputs assuming full delivery and a flat 0.3% fee. There is no `SupportingFeeOnTransfer` variant. For a fee-on-transfer input token the pair receives `amounts[0]*(1-fee)` while the router still requests the full output, so the K check (113–116) reverts. **No value is lost or stolen** — the whole tx reverts and the user keeps funds. This is identical, intentional Uniswap-V2 core behavior; no current token is fee-on-transfer (WETH9 is standard; zXMR behavior is speculative). Purely a compatibility note.

**Fix.** None required if UniV2 semantics are intended. Either document "fee-on-transfer/rebasing pair tokens are unsupported and will revert," or add supporting-fee-on-transfer swap functions that measure post-transfer balances.

---

### AMM-02 — `PairCreated` emits `allPairs.length` instead of the zero-based index
**Severity:** Info · **File:** `contracts/src/amm/Factory.sol:38`

**What it is.** `createPair` emits `PairCreated(..., allPairs.length)` after the push, so the field named `index` (declared L13) equals the new count `N`, not the pair's zero-based index `N-1`. On-chain state (`getPair`, `allPairs`) is correct; no fund impact. An indexer trusting the parameter name and calling `allPairs(index)` reads the wrong slot or reverts out-of-bounds. (This mirrors canonical UniV2 where the trailing field is conventionally the count, so most consumers already handle it — but the misleading name is worth fixing.)

**Fix.** Emit `allPairs.length - 1`.

---

### AMM-03 — `skim` lets any caller sweep un-synced excess to an arbitrary address
**Severity:** Info · **File:** `contracts/src/amm/Pair.sol:122`

**What it is.** `skim(to)` (122–125, `external nonReentrant`, no access control) sends `balanceOf(pair) - reserve` to a caller-chosen `to`. Reserves update only via `_sync`, so tokens transferred directly to a pair without an atomic mint are claimable by whoever calls `skim` first. Standard UniV2 semantics; a UX footgun, not a protocol-invariant break.

**Concrete case.** Alice transfers tokens to a pair in tx A intending to `mint` in tx B; before B, Mallory calls `skim(mallory)` and takes the excess. Alice's later `mint` sees `amount0 = 0` and reverts `InsufficientLiquidityMinted`.

**Fix.** No code change if UniV2 semantics are intended. Ensure the frontend only ever deposits via `Router.addLiquidity` (atomic transfer + mint) and never leaves un-synced balances between transactions.

---

## 3. Uncertain / Needs Review

None. The uncertain set was empty; every finding above was adversarially verified and confirmed.

---

## 4. Prioritized Remediation Checklist

**Before mainnet (must-fix):**
1. **ORACLE-02** — Add `require(maxStaleness != 0)` in constructor and setter, and redeploy/reconfigure the live oracle with a real staleness bound (the deployed config currently ships staleness protection disabled on WETH). Highest priority because it is *live in the deployed config*, not merely reachable.
2. **MM-01** — Make the `withdraw()` health check unconditional whenever the user has debt; stop gating it on the current collateral flag.
3. **MM-02** — Enforce `liqThresholdBps * (BPS + liqBonusBps) < BPS*BPS` for collateral reserves in `_validateConfig`.
4. **ORACLE-01** — Add per-asset price-failure isolation to the liquidation path (or a last-good-price fallback) so one stale feed cannot brick all liquidations for a borrower.

**Hardening (should-fix before listing non-default assets):**
5. **MM-03** — Measure received balance deltas on inbound transfers, or enforce a vetted token allowlist at listing time — required before zXMR or any non-standard token becomes a real reserve.
6. **ORACLE-03** — Revert on a zero scaled price; prefer multiply-then-truncate scaling. Needed before configuring any >8-decimal aggregator.

**Documentation / cosmetic (low urgency):**
7. **AMM-01** — Document that fee-on-transfer/rebasing pair tokens are unsupported (or add supporting-FoT swap variants).
8. **AMM-02** — Emit `allPairs.length - 1` in `PairCreated`.
9. **AMM-03** — Document/enforce Router-only atomic deposits; no contract change needed.

**Cross-cutting note:** Findings 1–5 all funnel toward the same failure mode — *unrecoverable bad debt* — through different doors (config toggles, parameter interplay, oracle liveness, token compatibility). The oracle liveness/staleness cluster (ORACLE-01, ORACLE-02) is the highest-leverage area to harden, since a fixed-price stablecoin set plus a single robust ETH feed removes most of the realistic mainnet exposure.