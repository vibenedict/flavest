"use client";

import { Contract, JsonRpcProvider } from "ethers";

/**
 * Read-only views of the Flare Data Connector (FDC) on Coston2.
 *
 * The anti-rug "Verified on Flare" claim is backed here by real infrastructure:
 * the FDC contracts are resolved live through the canonical FlareContractRegistry,
 * and — once `FlavestAttestationRegistry` is deployed and a verdict attested via
 * the Web2Json flow (see scripts/fdc/*) — attested safety verdicts are read back
 * from chain. No wallet needed for reads.
 *
 * Docs: https://dev.flare.network/fdc/overview
 */

const COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc";
const FLARE_CONTRACT_REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
export const COSTON2_EXPLORER = "https://coston2-explorer.flare.network";

/** Deployed FlavestAttestationRegistry (set NEXT_PUBLIC_FLAVEST_ATTEST_REGISTRY after deploy). */
export const FLAVEST_REGISTRY =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FLAVEST_ATTEST_REGISTRY) || "";

export type FdcStatus = {
  fdcHub: string;
  fdcVerification: string;
  feeConfig: string;
  votingRound: number;
  registry: string;
};

export type AttestedListing = {
  symbol: string;
  venue: string;
  safety: number;
  honeypot: boolean;
  lpLocked: boolean;
  renounced: boolean;
  votingRound: number;
  attestedAt: number;
};

let _provider: JsonRpcProvider | null = null;
const provider = () => (_provider ??= new JsonRpcProvider(COSTON2_RPC, undefined, { staticNetwork: true }));

const REGISTRY_ABI = ["function getContractAddressByName(string) view returns (address)"];

/** Live FDC infrastructure addresses + current voting round, read from Coston2. */
export async function fetchFdcStatus(): Promise<FdcStatus> {
  const reg = new Contract(FLARE_CONTRACT_REGISTRY, REGISTRY_ABI, provider());
  const [fdcHub, fdcVerification, feeConfig, fsm] = await Promise.all([
    reg.getContractAddressByName("FdcHub") as Promise<string>,
    reg.getContractAddressByName("FdcVerification") as Promise<string>,
    reg.getContractAddressByName("FdcRequestFeeConfigurations") as Promise<string>,
    reg.getContractAddressByName("FlareSystemsManager") as Promise<string>,
  ]);
  let votingRound = 0;
  try {
    const sys = new Contract(fsm, ["function getCurrentVotingEpochId() view returns (uint32)"], provider());
    votingRound = Number(await sys.getCurrentVotingEpochId());
  } catch {
    /* best-effort */
  }
  return { fdcHub, fdcVerification, feeConfig, votingRound, registry: FLAVEST_REGISTRY };
}

const FLAVEST_ABI = [
  "function getListing(string) view returns (tuple(string symbol,string venue,uint256 safety,bool honeypot,bool lpLocked,bool renounced,uint64 votingRound,uint256 attestedAt))",
];

/** Read an FDC-attested safety verdict for a symbol, or null if none / not deployed. */
export async function fetchAttestedListing(symbol: string): Promise<AttestedListing | null> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(FLAVEST_REGISTRY)) return null;
  try {
    const c = new Contract(FLAVEST_REGISTRY, FLAVEST_ABI, provider());
    const r = await c.getListing(symbol);
    if (!r || Number(r.attestedAt) === 0) return null;
    return {
      symbol: r.symbol,
      venue: r.venue,
      safety: Number(r.safety),
      honeypot: r.honeypot,
      lpLocked: r.lpLocked,
      renounced: r.renounced,
      votingRound: Number(r.votingRound),
      attestedAt: Number(r.attestedAt),
    };
  } catch {
    return null;
  }
}
