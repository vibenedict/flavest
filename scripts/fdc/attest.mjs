/**
 * Attest a token safety verdict end-to-end through the Flare Data Connector (FDC)
 * Web2Json type, and write the proven verdict into FlavestAttestationRegistry.
 *
 * Flow (mirrors flare-hardhat-starter/scripts/utils/fdc.ts):
 *   1. prepareRequest at the verifier  → abiEncodedRequest
 *   2. FdcHub.requestAttestation (pay the fee)  → voting round id
 *   3. wait until Relay.isFinalized(protocolId, round)
 *   4. fetch {response_hex, proof} from the DA layer, decode the response
 *   5. addAttestation({merkleProof, data}) → verifyWeb2Json checks it on-chain
 *
 * Run:  node --env-file=.env scripts/fdc/attest.mjs
 */
import { AbiCoder, Contract, JsonRpcProvider, Wallet, encodeBytes32String } from "ethers";

const REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019"; // FlareContractRegistry
const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error("Missing env:", k);
    process.exit(1);
  }
  return v;
};
const RPC = process.env.RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";
const PK = need("PRIVATE_KEY");
const VERIFIER = need("WEB2JSON_VERIFIER_URL").replace(/\/$/, "");
const API_KEY = need("VERIFIER_API_KEY");
const DA_LAYER = need("DA_LAYER_URL").replace(/\/$/, "");
const FLAVEST = need("NEXT_PUBLIC_FLAVEST_ATTEST_REGISTRY");
// Optional CLI override, e.g. `node ... attest.mjs "https://…/api/safety?token=FLXR"`.
const SAFETY_API = process.argv[2] || need("FLAVEST_SAFETY_API");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const provider = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
const wallet = new Wallet(PK, provider);
const reg = new Contract(REGISTRY, ["function getContractAddressByName(string) view returns (address)"], provider);
const at = (name) => reg.getContractAddressByName(name);

// Struct the verifier encodes the jq output into (matches FlavestAttestationRegistry).
const ABI_SIGNATURE = JSON.stringify({
  components: [
    { internalType: "string", name: "symbol", type: "string" },
    { internalType: "string", name: "venue", type: "string" },
    { internalType: "uint256", name: "safety", type: "uint256" },
    { internalType: "bool", name: "honeypot", type: "bool" },
    { internalType: "bool", name: "lpLocked", type: "bool" },
    { internalType: "bool", name: "renounced", type: "bool" },
  ],
  name: "dto",
  type: "tuple",
});

// IWeb2Json.Response, for decoding the DA layer's response_hex.
const RESPONSE_ABI =
  "tuple(bytes32 attestationType, bytes32 sourceId, uint64 votingRound, uint64 lowestUsedTimestamp, tuple(string url, string httpMethod, string headers, string queryParams, string body, string postProcessJq, string abiSignature) requestBody, tuple(bytes abiEncodedData) responseBody)";

async function main() {
  // 1) prepareRequest — the verifier wants query params in `queryParams`, not
  // inline in the URL (an inline `?…` triggers a FETCH ERROR).
  const api = new URL(SAFETY_API);
  const url = `${VERIFIER}/verifier/web2/Web2Json/prepareRequest`;
  console.log("1/5 prepareRequest →", url, "\n     attesting", SAFETY_API);
  const prep = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": API_KEY },
    body: JSON.stringify({
      attestationType: encodeBytes32String("Web2Json"),
      sourceId: encodeBytes32String("PublicWeb2"),
      requestBody: {
        url: api.origin + api.pathname,
        httpMethod: "GET",
        headers: "{}",
        queryParams: JSON.stringify(Object.fromEntries(api.searchParams)),
        body: "{}",
        postProcessJq:
          "{symbol: .symbol, venue: .venue, safety: .safety, honeypot: .honeypot, lpLocked: .lpLocked, renounced: .renounced}",
        abiSignature: ABI_SIGNATURE,
      },
    }),
  });
  if (prep.status !== 200) throw new Error(`verifier ${prep.status}: ${await prep.text()}`);
  const { abiEncodedRequest } = await prep.json();
  if (!abiEncodedRequest) throw new Error("verifier returned no abiEncodedRequest");

  // 2) submit to FdcHub with the required fee
  const feeCfg = new Contract(await at("FdcRequestFeeConfigurations"), ["function getRequestFee(bytes) view returns (uint256)"], provider);
  const fee = await feeCfg.getRequestFee(abiEncodedRequest);
  const fdcHub = new Contract(await at("FdcHub"), ["function requestAttestation(bytes) payable"], wallet);
  console.log("2/5 requestAttestation → fee", fee.toString(), "wei");
  const tx = await fdcHub.requestAttestation(abiEncodedRequest, { value: fee });
  const receipt = await tx.wait();

  // 3) compute round id + wait for finalization via Relay
  const fsm = new Contract(
    await at("FlareSystemsManager"),
    ["function firstVotingRoundStartTs() view returns (uint64)", "function votingEpochDurationSeconds() view returns (uint64)"],
    provider,
  );
  const block = await provider.getBlock(receipt.blockNumber);
  const t0 = await fsm.firstVotingRoundStartTs();
  const dur = await fsm.votingEpochDurationSeconds();
  const roundId = Number((BigInt(block.timestamp) - BigInt(t0)) / BigInt(dur));

  const fdcVerification = new Contract(await at("FdcVerification"), ["function fdcProtocolId() view returns (uint8)"], provider);
  const protocolId = await fdcVerification.fdcProtocolId();
  const relay = new Contract(await at("Relay"), ["function isFinalized(uint256,uint256) view returns (bool)"], provider);
  console.log("3/5 round", roundId, "— waiting for finalization…");
  while (!(await relay.isFinalized(protocolId, roundId))) await sleep(30000);

  // 4) fetch proof + response from the DA layer
  console.log("4/5 fetching proof from DA layer…");
  const daUrl = `${DA_LAYER}/api/v1/fdc/proof-by-request-round-raw`;
  let proof;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(daUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": API_KEY },
      body: JSON.stringify({ votingRoundId: roundId, requestBytes: abiEncodedRequest }),
    }).then((r) => r.json());
    if (res?.response_hex && res?.proof) {
      proof = res;
      break;
    }
    await sleep(10000);
  }
  if (!proof) throw new Error("proof not available from DA layer");

  // Deep-convert the frozen ethers Result into plain mutable arrays so it can
  // be re-encoded as the calldata tuple.
  const toPlain = (v) =>
    v && typeof v === "object" && typeof v.toArray === "function"
      ? v.toArray().map(toPlain)
      : Array.isArray(v)
        ? v.map(toPlain)
        : v;
  const decodedResponse = toPlain(AbiCoder.defaultAbiCoder().decode([RESPONSE_ABI], proof.response_hex)[0]);

  // 5) verify + store on-chain
  const flavest = new Contract(
    FLAVEST,
    ["function addAttestation((bytes32[],(bytes32,bytes32,uint64,uint64,(string,string,string,string,string,string,string),(bytes))) _proof) external"],
    wallet,
  );
  console.log("5/5 addAttestation → FlavestAttestationRegistry", FLAVEST);
  const store = await flavest.addAttestation([proof.proof, decodedResponse]);
  await store.wait();
  console.log("✓ Verdict attested on-chain via FDC. Round", roundId);
  console.log("→ Explorer: https://coston2-explorer.flare.network/tx/" + store.hash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
