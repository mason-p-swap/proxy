# Proxy Swap — Handoff

Two products in one app, both live on the **Sepolia** testnet:

1. **Exchange** — a Uniswap-v2-style AMM with a smart order router that routes each swap
   through either our own zXMR liquidity pools or Uniswap, plus native-ETH support.
2. **Money Market** — a multi-asset lending/borrowing protocol (supply, borrow, collateral,
   interest, liquidations) priced by a Chainlink-backed oracle.

Everything in this repo is functional on-chain today with **test tokens**. The remaining work
is the zXMR backend (real token, real price feed, and the Monero bridge), described in
[What's left for the zXMR owner](#whats-left-for-the-zxmr-owner).

---

## Deployed addresses (Sepolia, chain id 11155111)

Owner of every ownable contract: `0x86F173DABd543068f05D8c2e1f8eDCaEB2CBa1ca`

### Money Market
| Contract | Address |
| --- | --- |
| MoneyMarket | `0xD0f6A8fdDc8B92553896E4525B842B57b266e94E` |
| ChainlinkPriceOracle | `0x7bceA81573C4Ce0E6b3C0eC1db8397219f24fE18` |
| Chainlink ETH/USD feed | `0x694AA1769357215DE4FAC081bf1f309aDC325306` |

Listed reserves: zXMR, WETH, DAI, USDC, USDT (see token addresses below).

### Exchange (AMM)
| Contract | Address |
| --- | --- |
| Factory | `0x9990d69a11ceCf01b78d829AB4611d7405E08636` |
| Router (current, WETH-aware) | `0x24Ec2cfC4101787259ef2B4fD0400F6A25a01Da6` |
| WETH9 (real, backs native ETH) | `0x69CC6024C1d687997A95635F782eeE1F5206E8BB` |
| Router (old, superseded — do not use) | `0xFB1a45391C70Dd28F258FAf4684912A85cFC9029` |

ZeroFi pools (our liquidity):
| Pair | Address |
| --- | --- |
| zXMR / WETH9 | `0x60ABC716258A06CF719FC1A6a9f8435A30319810` |
| zXMR / USDC | `0xDdC741079e2977707Af09C5eaD7eB7f72DA7aD53` |
| zXMR / USDT | `0x3933AAA50CAFC9FE87949F3c5062B6e690D1fe92` |
| zXMR / DAI | `0x740595f1ADca363661eF51D6520F5BdB11066731` |

### Tokens
| Token | Address | Decimals |
| --- | --- | --- |
| zXMR (MockERC20, faucet+mint) | `0xAB79dB732C51c398F7DdDECD2cb4f7D9464E513A` | 18 |
| WETH9 (real wrapped ether) | `0x69CC6024C1d687997A95635F782eeE1F5206E8BB` | 18 |
| WETH (MockERC20, money-market only) | `0xB19Ac01CA95974BbBEfce4e57f8C2f6E3c234360` | 18 |
| USDC (MockUSDC) | `0x335FF97061154bf5372efb8C0b9b57F944279994` | 6 |
| USDT (MockERC20) | `0xA9CA2f149747cEB21A9AE707cb0A4380DBa3Ee02` | 6 |
| DAI (MockERC20) | `0x88E8ba943d04B2De1b1C7e1A2B84E501d90333e1` | 18 |

### Uniswap V2 (external, Sepolia)
| Contract | Address |
| --- | --- |
| Router | `0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3` |
| Factory | `0xF62c03E08ada871A0bEb309762E260a7a6a880E6` |

Pairs we seeded on Uniswap: WETH/USDC, WETH/USDT, WETH/DAI, USDC/USDT, USDC/DAI, USDT/DAI.

---

## How the order router works

`src/lib/route-engine.ts` chooses a venue per pair and returns a plan (venue + router
address + token path). The swap widget quotes and executes against that plan's router.

| Pair type | Venue | Path |
| --- | --- | --- |
| Anything ↔ zXMR | ZeroFi pool | direct |
| ETH / native ↔ token | ZeroFi pool | via zXMR hub, ETH wrapped through WETH9 |
| WETH ↔ stable, stable ↔ stable | Uniswap V2 | direct, with fallback to the ZeroFi zXMR hub |
| Anything ↔ XMR | not yet routable — see below | `ASSET → zXMR → XMR` |

If a venue can't quote a pair (no liquidity), the engine automatically falls back to the
other venue. Fee is 0.3% per hop, matching Uniswap.

---

## What's left for the zXMR owner

The whole app is wired around zXMR as the hub. Three integration points remain, all
isolated so they can be swapped in without touching the rest of the app:

### 1. Real zXMR token
Today zXMR is a `MockERC20` with a public faucet. Replace it with the production zXMR
contract, then update its address in `src/lib/web3.ts` (`ADDR_AMM.zxmr`, `ADDR_V2.zxmr`,
`SWAP_TOKENS`), re-create + seed the pools, and re-list it in the money market
(`contracts/script/AddZxmrReserve.s.sol` shows the exact listing call and risk params).

### 2. Real zXMR price feed
The oracle currently uses a fixed price (`setFixedPrice(zXMR, $282.95)`). Replace with either
a Chainlink XMR/USD aggregator (`setAggregator`) on the target chain, or a TWAP oracle read
from the zXMR pools. This one call is what makes zXMR collateral safe against manipulation.

### 3. Monero bridge unwrap SDK  ← the missing cross-chain leg
XMR pairs (`ETH↔XMR`, `USDC↔XMR`, etc.) route as `ASSET → zXMR → XMR`. The
`ASSET → zXMR` leg is fully live on-chain. The final `zXMR → XMR` unwrap needs the ZeroFi
bridge SDK, which does not exist yet. Integration points once it does:
- `src/lib/route-engine.ts` — XMR pairs currently return no route (`comingSoon`). Add the
  bridge call as the terminal hop after the on-chain `ASSET → zXMR` swap.
- `src/components/swap-widget.tsx` — add a Monero destination-address field for XMR-out swaps.
- Backend/relayer — after the on-chain swap into zXMR, the bridge burns/locks zXMR and
  releases native XMR to the user's Monero address.

---

## Deploy / ops scripts (`contracts/script/`)
| Script | Purpose |
| --- | --- |
| `DeployMoneyMarket.s.sol` | Money market + oracle + mock tokens |
| `UpgradeToChainlink.s.sol` | Swap the money-market oracle to the Chainlink-backed one |
| `AddZxmrReserve.s.sol` | List zXMR in the money market (price + risk params) |
| `DeployAmm.s.sol` | Factory, Router, zXMR, and the zXMR/stable pools |
| `DeployEthPool.s.sol` | Real WETH9, WETH-aware Router, zXMR/ETH pool |
| `SeedUniswap.s.sol` | Create + seed our 6 token pairs on Uniswap V2 |
| `RebalancePools.s.sol` | Move the zXMR stable pools to the oracle price |

All scripts broadcast with an encrypted keystore:
`forge script script/<name>.s.sol --rpc-url <sepolia> --account <keystore> --sender <owner> --broadcast`

## Tests
`cd contracts && forge test` — full suite (AMM unit + invariants, money-market unit +
invariants, ETH-path tests). All green.

## Known testnet limitations
- Tokens are valueless mocks; faucets are enabled and must be removed for production.
- Pool depth is small (seeded from faucet ETH), so large swaps show high price impact.
- **Not audited.** A professional audit is required before any real-value deployment.
