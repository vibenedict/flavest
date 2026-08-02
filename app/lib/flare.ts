"use client";

import { useCallback, useEffect, useState } from "react";

/** Supported Flare networks (the values offered by the design's `network` prop). */
export type FlareNetwork = "Flare Mainnet" | "Songbird" | "Coston2 Testnet";

type ChainParams = {
  chainId: string; // hex
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
};

export const FLARE_CHAINS: Record<FlareNetwork, ChainParams> = {
  "Flare Mainnet": {
    chainId: "0xe", // 14
    chainName: "Flare Mainnet",
    nativeCurrency: { name: "Flare", symbol: "FLR", decimals: 18 },
    rpcUrls: ["https://flare-api.flare.network/ext/C/rpc"],
    blockExplorerUrls: ["https://flare-explorer.flare.network"],
  },
  Songbird: {
    chainId: "0x13", // 19
    chainName: "Songbird Canary-Network",
    nativeCurrency: { name: "Songbird", symbol: "SGB", decimals: 18 },
    rpcUrls: ["https://songbird-api.flare.network/ext/C/rpc"],
    blockExplorerUrls: ["https://songbird-explorer.flare.network"],
  },
  "Coston2 Testnet": {
    chainId: "0x72", // 114
    chainName: "Flare Testnet Coston2",
    nativeCurrency: { name: "Coston2 Flare", symbol: "C2FLR", decimals: 18 },
    rpcUrls: ["https://coston2-api.flare.network/ext/C/rpc"],
    blockExplorerUrls: ["https://coston2-explorer.flare.network"],
  },
};

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...a: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...a: unknown[]) => void) => void;
};

function getProvider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum ?? null;
}

function shorten(addr: string): string {
  if (!/^0x[0-9a-fA-F]{6,}$/.test(addr)) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-3)}`;
}

/** Optional payment recipient. Empty → transactions self-send (safe default). */
export const TREASURY =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FLAVEST_TREASURY) || "";

const isAddress = (a?: string): a is string => !!a && /^0x[0-9a-fA-F]{40}$/.test(a);

/** Convert a decimal FLR amount (e.g. "15" or "0.0018") to a wei hex string. */
export function flrToWeiHex(amount: string | number): string {
  const clean = String(amount).replace(/,/g, "").trim();
  const [w, f = ""] = clean.replace("-", "").split(".");
  const frac = (f + "0".repeat(18)).slice(0, 18);
  const wei = BigInt(w || "0") * 10n ** 18n + BigInt(frac || "0");
  return "0x" + wei.toString(16);
}

/** Encode a short ASCII string as tx calldata so the action is identifiable on-chain. */
export function memoHex(s: string): string {
  let out = "0x";
  for (let i = 0; i < s.length; i++) out += (s.charCodeAt(i) & 0xff).toString(16).padStart(2, "0");
  return out;
}

function fmtBalance(weiHex: string, decimals = 18): string {
  try {
    const wei = BigInt(weiHex);
    const base = BigInt(10) ** BigInt(decimals);
    const whole = wei / base;
    const frac = Number((wei % base) * BigInt(1000) / base) / 1000; // 1 dp
    const num = Number(whole) + frac;
    return num.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  } catch {
    return "0.0";
  }
}

export type WalletState = {
  conn: boolean;
  address: string; // full 0x… or demo short
  addrShort: string;
  balance: string; // formatted, e.g. "1,240.5"
  networkName: string;
  isDemo: boolean;
};

const DEMO: WalletState = {
  conn: true,
  address: "0x7A3f0000000000000000000000000000000009C2",
  addrShort: "0x7A3f…9C2",
  balance: "1,240.5",
  networkName: "Flare Mainnet",
  isDemo: true,
};

export function useFlareWallet(network: FlareNetwork) {
  const [state, setState] = useState<WalletState>({
    conn: false,
    address: "",
    addrShort: "",
    balance: "0.0",
    networkName: network,
    isDemo: false,
  });

  const connect = useCallback(async () => {
    const provider = getProvider();
    const chain = FLARE_CHAINS[network];
    if (!provider) {
      // No injected wallet — run the prototype against a demo account.
      setState({ ...DEMO, networkName: network });
      return;
    }
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const account = accounts?.[0];
      if (!account) throw new Error("No account authorized");

      // Ensure the wallet is pointed at the selected Flare network.
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chain.chainId }],
        });
      } catch (switchErr) {
        const code = (switchErr as { code?: number })?.code;
        if (code === 4902) {
          await provider.request({ method: "wallet_addEthereumChain", params: [chain] });
        }
      }

      let balance = "0.0";
      try {
        const weiHex = (await provider.request({
          method: "eth_getBalance",
          params: [account, "latest"],
        })) as string;
        balance = fmtBalance(weiHex, chain.nativeCurrency.decimals);
      } catch {
        /* balance is best-effort */
      }

      setState({
        conn: true,
        address: account,
        addrShort: shorten(account),
        balance,
        networkName: chain.chainName,
        isDemo: false,
      });
    } catch {
      // User rejected or wallet errored — fall back to the demo account so the
      // prototype's billing / swap flows remain explorable.
      setState({ ...DEMO, networkName: network });
    }
  }, [network]);

  const disconnect = useCallback(() => {
    setState((s) => ({ ...s, conn: false, isDemo: false }));
  }, []);

  /**
   * Broadcast a real transaction from the connected wallet on Flare and return
   * the tx hash. Throws for a demo wallet (the caller then simulates). `to`
   * defaults to the configured treasury, else the sender's own address.
   */
  const send = useCallback(
    async (p: { to?: string; valueFlr: string | number; data?: string }): Promise<string> => {
      const provider = getProvider();
      if (!provider) throw new Error("No injected wallet");
      if (!state.conn || state.isDemo || !isAddress(state.address)) {
        throw new Error("A real wallet must be connected to send transactions");
      }
      const to = isAddress(p.to) ? p.to : isAddress(TREASURY) ? TREASURY : state.address;
      const tx: Record<string, string> = {
        from: state.address,
        to,
        value: flrToWeiHex(p.valueFlr),
      };
      if (p.data) tx.data = p.data;
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [tx],
      })) as string;
      return hash;
    },
    [state.conn, state.isDemo, state.address],
  );

  const explorerTxUrl = useCallback(
    (hash: string) => `${FLARE_CHAINS[network].blockExplorerUrls[0]}/tx/${hash}`,
    [network],
  );

  // Reflect account/chain changes from the injected wallet.
  useEffect(() => {
    const provider = getProvider();
    if (!provider?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts?.length) {
        setState((s) => ({ ...s, conn: false }));
      } else {
        setState((s) =>
          s.conn && !s.isDemo
            ? { ...s, address: accounts[0], addrShort: shorten(accounts[0]) }
            : s,
        );
      }
    };
    provider.on("accountsChanged", onAccounts);
    return () => provider.removeListener?.("accountsChanged", onAccounts);
  }, []);

  return { wallet: state, connect, disconnect, send, explorerTxUrl };
}
