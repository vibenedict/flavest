/**
 * Attest a token safety verdict end-to-end through the Flare Data Connector (FDC),
 * using the Web2Json attestation type, and write the proven verdict into
 * FlavestAttestationRegistry on Coston2.
 *
 * Flow (see https://dev.flare.network/fdc/overview):
 *   1. prepareRequest  → verifier returns the ABI-encoded attestation request + MIC
 *   2. requestAttestation on FdcHub (pay the fee from FdcRequestFeeConfigurations)
 *   3. wait for the voting round to finalize
 *   4. fetch the Merkle proof + response from the Data Availability layer
 *   5. addAttestation(proof) on the registry → verifyWeb2Json checks it on-chain
 *
 * Run:  node --env-file=.env scripts/fdc/attest.mjs
 * Requires: PRIVATE_KEY (funded Coston2), VERIFIER_API_KEY, WEB2JSON_VERIFIER_URL,
 *           DA_LAYER_URL, NEXT_PUBLIC_FLAVEST_ATTEST_REGISTRY, FLAVEST_SAFETY_API.
 */
import { Contract, JsonRpcProvider, Wallet, encodeBytes32String } from "ethers";

const RPC = process.env.RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";
const REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019"; // FlareContractRegistry
const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error("Missing env:", k);
    process.exit(1);
  }
  return v;
};

const PK = need("PRIVATE_KEY");
const VERIFIER = need("WEB2JSON_VERIFIER_URL").replace(/\/?$/, "/");
const API_KEY = need("VERIFIER_API_KEY");
const DA_LAYER = need("DA_LAYER_URL").replace(/\/?$/, "/");
const FLAVEST = need("NEXT_PUBLIC_FLAVEST_ATTEST_REGISTRY");
const SAFETY_API = need("FLAVEST_SAFETY_API");

const provider = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
const wallet = new Wallet(PK, provider);
const reg = new Contract(REGISTRY, ["function getContractAddressByName(string) view returns (address)"], provider);

// The struct FlavestAttestationRegistry decodes the attested response into.
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

async function main() {
  // 1) Prepare the attestation request via the verifier.
  const prepareBody = {
    attestationType: encodeBytes32String("Web2Json"),
    sourceId: encodeBytes32String("PublicWeb2"),
    requestBody: {
      url: SAFETY_API,
      httpMethod: "GET",
      headers: "{}",
      queryParams: "{}",
      body: "{}",
      // Map your safety API's JSON into the DataTransportObject fields.
      postProcessJq:
        "{symbol: .symbol, venue: .venue, safety: (.safety|floor), honeypot: .honeypot, lpLocked: .lpLocked, renounced: .renounced}",
      abiSignature: ABI_SIGNATURE,
    },
  };

  console.log("1/5 prepareRequest →", VERIFIER + "Web2Json/prepareRequest");
  const prep = await fetch(VERIFIER + "Web2Json/prepareRequest", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": API_KEY },
    body: JSON.stringify(prepareBody),
  }).then((r) => r.json());
  if (prep.status !== "VALID") throw new Error("verifier rejected request: " + JSON.stringify(prep));
  const abiEncodedRequest = prep.abiEncodedRequest;

  // 2) Submit the request to FdcHub, paying the required fee.
  const fdcHubAddr = await reg.getContractAddressByName("FdcHub");
  const feeCfgAddr = await reg.getContractAddressByName("FdcRequestFeeConfigurations");
  const fsmAddr = await reg.getContractAddressByName("FlareSystemsManager");

  const feeCfg = new Contract(feeCfgAddr, ["function getRequestFee(bytes) view returns (uint256)"], provider);
  const fee = await feeCfg.getRequestFee(abiEncodedRequest);

  const fdcHub = new Contract(fdcHubAddr, ["function requestAttestation(bytes) payable"], wallet);
  console.log("2/5 requestAttestation → FdcHub", fdcHubAddr, "fee", fee.toString());
  const tx = await fdcHub.requestAttestation(abiEncodedRequest, { value: fee });
  const receipt = await tx.wait();
  const block = await provider.getBlock(receipt.blockNumber);

  // 3) Derive the voting round and wait for finalization.
  const fsm = new Contract(
    fsmAddr,
    [
      "function firstVotingRoundStartTs() view returns (uint64)",
      "function votingEpochDurationSeconds() view returns (uint64)",
      "function getCurrentVotingEpochId() view returns (uint32)",
    ],
    provider,
  );
  const t0 = Number(await fsm.firstVotingRoundStartTs());
  const dur = Number(await fsm.votingEpochDurationSeconds());
  const roundId = Math.floor((Number(block.timestamp) - t0) / dur);
  console.log("3/5 submitted in voting round", roundId, "— waiting for finalization…");
  for (;;) {
    const cur = Number(await fsm.getCurrentVotingEpochId());
    if (cur > roundId + 1) break;
    await new Promise((r) => setTimeout(r, 10000));
  }

  // 4) Fetch the Merkle proof + response from the DA layer.
  console.log("4/5 fetching proof from DA layer…");
  let proof;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(DA_LAYER + "api/v1/fdc/proof-by-request-round-raw", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": API_KEY },
      body: JSON.stringify({ votingRoundId: roundId, requestBytes: abiEncodedRequest }),
    }).then((r) => r.json());
    if (res?.proof && res?.response) {
      proof = { merkleProof: res.proof, data: res.response };
      break;
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  if (!proof) throw new Error("proof not available from DA layer yet — retry shortly");

  // 5) Verify + store on-chain.
  const flavest = new Contract(FLAVEST, ["function addAttestation((bytes32[],(bytes32,bytes32,uint64,uint64,(string,string,string,string,string,string,string),(bytes)))) external"], wallet);
  console.log("5/5 addAttestation → FlavestAttestationRegistry", FLAVEST);
  const store = await flavest.addAttestation(proof);
  await store.wait();
  console.log("✓ Attested on-chain. Verdict is now provable via FDC.");
  console.log("→ Explorer: https://coston2-explorer.flare.network/tx/" + store.hash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
