// Deploy FlavestAttestationRegistry to Coston2 (or Flare).
// Prereq: `npx hardhat compile` (produces artifacts/), and PRIVATE_KEY funded on Coston2.
//   node --env-file=.env scripts/fdc/deploy.mjs
import { readFileSync } from "node:fs";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const RPC = process.env.RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";
const PK = process.env.PRIVATE_KEY;
if (!PK) {
  console.error("Set PRIVATE_KEY (funded Coston2 account · faucet https://faucet.flare.network/coston2)");
  process.exit(1);
}

const artifact = JSON.parse(
  readFileSync(
    new URL("../../artifacts/contracts/FlavestAttestationRegistry.sol/FlavestAttestationRegistry.json", import.meta.url),
  ),
);

const provider = new JsonRpcProvider(RPC, undefined, { staticNetwork: true });
const wallet = new Wallet(PK, provider);
console.log("Deploying FlavestAttestationRegistry from", wallet.address);

const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
const contract = await factory.deploy();
await contract.waitForDeployment();
const address = await contract.getAddress();

console.log("✓ Deployed:", address);
console.log("→ Add to .env:  NEXT_PUBLIC_FLAVEST_ATTEST_REGISTRY=" + address);
console.log("→ Explorer:     https://coston2-explorer.flare.network/address/" + address);
