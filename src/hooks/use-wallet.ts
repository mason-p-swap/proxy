import { useSyncExternalStore } from "react"
import type { Address } from "viem"
import { SEPOLIA_CHAIN_ID } from "@/lib/web3"

type WalletState = {

  hasProvider: boolean

  account: Address | null

  chainId: number | null

  connecting: boolean
}

let state: WalletState = {
  hasProvider: typeof window !== "undefined" && Boolean(window.ethereum),
  account: null,
  chainId: null,
  connecting: false,
}

const listeners = new Set<() => void>()

function setState(patch: Partial<WalletState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): WalletState {
  return state
}

let wired = false
function wireProviderEvents() {
  if (wired || !window.ethereum?.on) return
  wired = true
  window.ethereum.on("accountsChanged", (accounts: string[]) => {
    setState({ account: (accounts[0] as Address) ?? null })
  })
  window.ethereum.on("chainChanged", (hexId: string) => {
    setState({ chainId: parseInt(hexId, 16) })
  })
}

async function restore() {
  if (!window.ethereum) return
  wireProviderEvents()
  try {
    const [accounts, hexId] = await Promise.all([
      window.ethereum.request({ method: "eth_accounts" }),
      window.ethereum.request({ method: "eth_chainId" }),
    ])
    setState({
      account: (accounts?.[0] as Address) ?? null,
      chainId: hexId ? parseInt(hexId, 16) : null,
    })
  } catch {

  }
}

let restored = false

export async function connectWallet(): Promise<void> {
  if (!window.ethereum) return
  wireProviderEvents()
  setState({ connecting: true })
  try {
    const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" })
    const hexId: string = await window.ethereum.request({ method: "eth_chainId" })
    setState({ account: (accounts?.[0] as Address) ?? null, chainId: parseInt(hexId, 16) })
  } catch {

  } finally {
    setState({ connecting: false })
  }
}

export async function switchToSepolia(): Promise<void> {
  if (!window.ethereum) return
  const hexId = "0x" + SEPOLIA_CHAIN_ID.toString(16)
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    })
  } catch (e: any) {
    if (e?.code === 4902) {

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hexId,
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
          blockExplorerUrls: ["https://eth-sepolia.blockscout.com"],
        }],
      })
    }
  }
}

export function useWallet() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  if (!restored && typeof window !== "undefined") {
    restored = true
    restore()
  }
  return {
    ...snap,
    onSepolia: snap.chainId === SEPOLIA_CHAIN_ID,
  }
}

export function shortAddress(addr: string): string {
  return addr.slice(0, 6) + "…" + addr.slice(-4)
}
