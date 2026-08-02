"use client";

import { Contract, JsonRpcProvider } from "ethers";

/**
 * Live on-chain reads from Flare's FTSO Time Series Oracle (FTSOv2).
 *
 * These are genuine block-latency oracle prices read directly from Flare —
 * no wallet or signing required — via the public Flare RPC. The FtsoV2 contract
 * address is resolved through the canonical FlareContractRegistry so it keeps
 * working across Flare upgrades.
 *
 * Docs: https://dev.flare.network/ftso/getting-started
 */

const FLARE_RPC = "https://flare-api.flare.network/ext/C/rpc";
const FLARE_CONTRACT_REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

// bytes21 feed IDs: category 0x01 (crypto) + hex("SYMBOL/USD") right-padded to 21 bytes.
export const FEED_IDS: Record<string, string> = {
  FLR: "0x01464c522f55534400000000000000000000000000",
  BTC: "0x014254432f55534400000000000000000000000000",
  ETH: "0x014554482f55534400000000000000000000000000",
};

const REGISTRY_ABI = ["function getContractAddressByName(string _name) view returns (address)"];
// Declared `view` locally so ethers issues an eth_call (the on-chain method is
// payable, but a static read never sends value).
const FTSOV2_ABI = [
  "function getFeedsById(bytes21[] _feedIds) view returns (uint256[] _values, int8[] _decimals, uint64 _timestamp)",
];

export type FtsoPrices = {
  FLR: number;
  BTC: number;
  ETH: number;
  timestamp: number; // unix seconds from the oracle
  ftsoV2: string; // resolved FtsoV2 contract address
};

let cachedFtsoV2Addr: string | null = null;

/** Read live FLR/BTC/ETH USD prices from Flare's FTSOv2 oracle. */
export async function fetchFtsoPrices(): Promise<FtsoPrices> {
  const provider = new JsonRpcProvider(FLARE_RPC, undefined, { staticNetwork: true });

  if (!cachedFtsoV2Addr) {
    const registry = new Contract(FLARE_CONTRACT_REGISTRY, REGISTRY_ABI, provider);
    cachedFtsoV2Addr = (await registry.getContractAddressByName("FtsoV2")) as string;
  }

  const ftso = new Contract(cachedFtsoV2Addr, FTSOV2_ABI, provider);
  const order = ["FLR", "BTC", "ETH"];
  const [values, decimals, timestamp] = (await ftso.getFeedsById(order.map((k) => FEED_IDS[k]))) as [
    bigint[],
    bigint[],
    bigint,
  ];

  const price = (i: number) => Number(values[i]) / 10 ** Number(decimals[i]);
  return {
    FLR: price(0),
    BTC: price(1),
    ETH: price(2),
    timestamp: Number(timestamp),
    ftsoV2: cachedFtsoV2Addr,
  };
}
