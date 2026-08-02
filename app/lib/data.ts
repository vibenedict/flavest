export const RISK = { safe: "#34d399", warn: "#fbbf24", danger: "#ff5a7a" };

export type Token = {
  id: string;
  sym: string;
  name: string;
  mono: string;
  iconBg: string;
  source: "DEX" | "CEX";
  venue: string;
  chain: string;
  chainColor: string;
  liq: string;
  liqRaw: number;
  price: string;
  age: string;
  safety: number;
  contract: string;
  mcap: string;
  holders: string;
  lock: string;
  honeypot: boolean;
  lpLocked: boolean;
  renounced: boolean;
  mintOff: boolean;
  lpBurned: boolean;
  receipt: string;
};

// The detection feed. In production this streams from CEX websockets, DEX pair
// indexers, and the Flare FDC relayer; here it is a representative snapshot.
export const TOKENS: Token[] = [
  { id: "nova", sym: "$NOVA", name: "Nova Protocol", mono: "NV", iconBg: "linear-gradient(135deg,#9184d9,#5d5294)", source: "DEX", venue: "SparkDEX", chain: "Flare", chainColor: "#e6224a", liq: "$142.0k", liqRaw: 142, price: "$0.0041", age: "4s", safety: 82, contract: "0x9f…A213", mcap: "$1.9M", holders: "214", lock: "Sep 12, 2026 (90d)", honeypot: true, lpLocked: true, renounced: true, mintOff: true, lpBurned: false, receipt: "0x8f…c1a2" },
  { id: "flxr", sym: "$FLXR", name: "Flare XR", mono: "FX", iconBg: "linear-gradient(135deg,#e6224a,#7a1530)", source: "DEX", venue: "Enosys", chain: "Flare", chainColor: "#e6224a", liq: "$88.4k", liqRaw: 88, price: "$0.129", age: "22s", safety: 91, contract: "0x3b…77E1", mcap: "$4.2M", holders: "508", lock: "Locked 180d", honeypot: true, lpLocked: true, renounced: true, mintOff: true, lpBurned: true, receipt: "0x2d…9f04" },
  { id: "zkp", sym: "$ZKP", name: "ZeroKey", mono: "ZK", iconBg: "linear-gradient(135deg,#627EEA,#2f3f78)", source: "CEX", venue: "Binance", chain: "Ethereum", chainColor: "#627EEA", liq: "—", liqRaw: 9999, price: "$0.54", age: "1m", safety: 88, contract: "0x11…FA02", mcap: "$54M", holders: "—", lock: "Exchange custody", honeypot: true, lpLocked: true, renounced: true, mintOff: true, lpBurned: false, receipt: "0x71…33ab" },
  { id: "raze", sym: "$RAZE", name: "Razer Inu", mono: "RZ", iconBg: "linear-gradient(135deg,#c96a6a,#6e2e2e)", source: "DEX", venue: "Pancake", chain: "BSC", chainColor: "#F0B90B", liq: "$31.2k", liqRaw: 31, price: "$0.0000071", age: "38s", safety: 34, contract: "0xa7…0091", mcap: "$120k", holders: "46", lock: "Unlocked", honeypot: false, lpLocked: false, renounced: false, mintOff: false, lpBurned: false, receipt: "blocked" },
  { id: "sol9", sym: "$SOL9", name: "Solnine", mono: "S9", iconBg: "linear-gradient(135deg,#14F195,#0a6b43)", source: "DEX", venue: "Raydium", chain: "Solana", chainColor: "#14F195", liq: "$67.5k", liqRaw: 67, price: "$0.0088", age: "51s", safety: 71, contract: "8Kd…2fQ", mcap: "$880k", holders: "132", lock: "Locked 30d", honeypot: true, lpLocked: true, renounced: false, mintOff: true, lpBurned: false, receipt: "0x4c…120e" },
  { id: "okxg", sym: "$GRV", name: "Gravity", mono: "GV", iconBg: "linear-gradient(135deg,#a7a1db,#5c5783)", source: "CEX", venue: "OKX", chain: "Ethereum", chainColor: "#627EEA", liq: "—", liqRaw: 9999, price: "$1.22", age: "2m", safety: 79, contract: "0x55…9C7D", mcap: "$210M", holders: "—", lock: "Exchange custody", honeypot: true, lpLocked: true, renounced: true, mintOff: true, lpBurned: false, receipt: "0x90…5e71" },
  { id: "pump", sym: "$PUMP", name: "PumpCat", mono: "PC", iconBg: "linear-gradient(135deg,#c9a15a,#6e5320)", source: "DEX", venue: "Raydium", chain: "Solana", chainColor: "#14F195", liq: "$19.9k", liqRaw: 20, price: "$0.00021", age: "1m", safety: 52, contract: "3Ab…9xR", mcap: "$310k", holders: "88", lock: "Locked 14d", honeypot: true, lpLocked: true, renounced: false, mintOff: false, lpBurned: false, receipt: "0x6a…77c9" },
];

export function risk(s: number): { label: string; color: string } {
  return s >= 75
    ? { label: "Safe", color: RISK.safe }
    : s >= 45
      ? { label: "Caution", color: RISK.warn }
      : { label: "High risk", color: RISK.danger };
}

export function srcStyle(src: string): string {
  const bg = src === "CEX" ? "var(--color-accent-2-800)" : "var(--color-accent-800)";
  const fg = src === "CEX" ? "var(--color-accent-2-100)" : "var(--color-accent-100)";
  return `display:inline-flex;font-size:10.5px;padding:2px 7px;border-radius:5px;background:${bg};color:${fg}`;
}

export type Tier = "scout" | "pro" | "alpha";
export const TIER_LABEL: Record<Tier, string> = { scout: "Scout", pro: "Pro", alpha: "Alpha" };
