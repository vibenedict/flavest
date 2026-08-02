# Flavest · Launch Radar

A real-time **CEX listing + DEX new-pair tracker** with an anti-rug **Safety Engine**, built on the **Flare Network**. Every alert's safety verdict is attested on-chain via Flare's Data Connector (FDC) and priced against the FTSOv2 feed, so alerts are provably not fabricated. Subscriptions, staking, pay-per-alert and swaps all settle on Flare and charge FLR gas.

This is the working implementation of the `Flavest.dc.html` design comp, built with Next.js + React and the **Nocturne** design system (ported to `app/globals.css`).

## Views

- **Live Feed** — detected pairs/listings, safety-scored, filterable by source (DEX / CEX / Flare-native) and a min-safety slider.
- **Token detail** — full anti-rug safety report (honeypot sim, LP lock, ownership renounced, mint disabled, LP burned, blacklist/fee-trap), Flare verification panel, market stats, and a gas-charging trade action.
- **Alerts & Filters** — source toggles, liquidity/safety thresholds, delivery channels (Telegram / in-app push / webhook), pay-per-alert, and a live rule preview; rules are saved on-chain.
- **Wallet & Billing** — Scout / Pro / Alpha tiers, stake-to-unlock, one-time seat purchase, and an on-chain activity table.
- **Swap & Transfer** — Convert / Buy / Transfer with FTSOv2-anchored rates and a gas-signing confirmation dialog.
- **Mobile Preview** — push-alert and Telegram delivery mockups.

## Flare integration

Flare is used in three concrete, non-cosmetic ways:

### 1. Live FTSOv2 oracle prices (read on-chain, no wallet)

`app/lib/ftso.ts` reads real block-latency prices from Flare's **FTSO Time Series Oracle (FTSOv2)** over the public Flare RPC:

- Resolves the `FtsoV2` contract through the canonical **FlareContractRegistry** (`0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019` → `getContractAddressByName("FtsoV2")`), so it survives contract upgrades.
- Batch-reads FLR/USD, BTC/USD and ETH/USD via `getFeedsById(bytes21[])` and refreshes every ~20s.
- The **live FLR/USD price drives the Swap "you receive" math and every USD conversion** (wallet value, balances) — not a hardcoded constant. Verified live: `FtsoV2 = 0x7BDE3Df0624114eDB3A67dFe6753e62f4e7c1d20`.
- Shown as a live oracle ticker in the header. Reads happen without a connected wallet; failures fall back to the last good value.

### 2. Real on-chain transactions

`app/lib/flare.ts` connects a real EIP-1193 wallet (e.g. MetaMask) to **Flare Mainnet** (chain `14`), auto-adding the network if missing, and reads the live FLR balance. Songbird and Coston2 are pre-configured.

**Real transactions.** With a genuine wallet connected, every "Confirm & sign" broadcasts an actual transaction via `eth_sendTransaction`, pays real gas, and the success toast links to the tx on the Flare block explorer:

- **Transfer** sends real FLR to the recipient address you enter (validated on-chain amount + address).
- **Subscribe / Stake / Buy seat / Trade / Save alert-rule / Buy / Convert** broadcast a real **0‑value transaction to yourself** carrying an on-chain memo in calldata (e.g. `flavest:subscribe:pro`). This is genuinely mined and costs gas, but never drains large FLR amounts from a demo wallet. Set `NEXT_PUBLIC_FLAVEST_TREASURY` to route those payments to a real address instead of self.

If no injected wallet is present, the app falls back to a demo account and the signature is **simulated** (labelled as such in the dialog) so the full flow stays explorable without a wallet.

### 3. FDC anti-rug attestation (Web2Json)

`contracts/FlavestAttestationRegistry.sol` is a real **FDC consumer contract** for Coston2. It records a token's safety verdict **only if `ContractRegistry.getFdcVerification().verifyWeb2Json(proof)` succeeds** — i.e. the verdict was fetched off-chain and attested by Flare's data providers. It compiles against the official `@flarenetwork/flare-periphery-contracts` (EVM `cancun`).

- `scripts/fdc/deploy.mjs` — deploy the registry to Coston2.
- `scripts/fdc/attest.mjs` — the full FDC flow: `prepareRequest` → `FdcHub.requestAttestation` (pays the fee) → wait for round finalization → fetch the Merkle proof from the DA layer → `addAttestation` (verified on-chain).
- `app/lib/fdc.ts` — the app resolves the live FDC contracts + current voting round from Coston2, and reads attested verdicts back from the registry. The token detail's **"Verified on Flare"** panel shows the real FDC verifier address (links to the Coston2 explorer) and the live voting round.

Set `NEXT_PUBLIC_FLAVEST_ATTEST_REGISTRY` after deploy so the app reads verdicts from your instance. To attest for real you supply a verifier API key + a funded Coston2 key (see `.env.example`).

### 4. On-chain identity + activity

The connected Flare address, live FLR balance and network drive the whole billing surface. Every signed action is appended to an **On-chain activity** log whose hashes deep-link to the Flare explorer, persisted in `localStorage`.

> Still represented in the UI but not yet real contracts: DEX router **swaps** (memo tx today) and per-token FTSOv2 price anchoring for the fake demo tokens. Honest next steps below. The transactions sent, the FTSO oracle reads, and the FDC verification path are genuine.

## Contracts

```bash
npx hardhat compile                                   # compiles FlavestAttestationRegistry
node --env-file=.env scripts/fdc/deploy.mjs           # deploy to Coston2
node --env-file=.env scripts/fdc/attest.mjs           # run the FDC Web2Json attestation
```

## Evidence of new work

Everything here was built during the program from the `Flavest.dc.html` design comp:

- Ported the Nocturne design system and the full 6-view dashboard from a static design comp into a working Next.js 15 / React 19 app.
- Built a Flare wallet module (`flare.ts`): connect, auto-add-network, balance reads, and real `eth_sendTransaction` broadcasting with treasury routing + calldata memos.
- **Integrated FTSOv2** (`ftso.ts`): registry-resolved on-chain oracle reads driving live pricing — verified against Flare mainnet.
- Live transaction history with explorer links, persisted to `localStorage`.

## Roadmap / future potential

1. **Real detection engine** — subscribe to SparkDEX/Enosys pool-creation events over a Flare RPC WebSocket + CEX announcement APIs to populate the feed for real.
2. **Automate the FDC pipeline** — the `FlavestAttestationRegistry` + Web2Json flow already attest verdicts on demand; run it on every detection so each alert ships with a fresh on-chain attestation.
3. **Real swaps** — route Convert/Buy through a SparkDEX/Enosys router contract with token approvals, keeping FTSOv2 as the reference price.
4. **A Flavest subscription/alert-rule contract** — replace the memo transactions with a real contract so subscriptions, staking and rules are enforced on-chain.
5. **Telegram delivery worker** + per-address history from the explorer API.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Structure

- `app/page.tsx` — entry
- `app/components/FlavestApp.tsx` — the dashboard (all views, dialog, toast)
- `app/components/Background.tsx` — animated colour-wash + floating coins
- `app/lib/data.ts` — token feed + risk/source-style helpers
- `app/lib/flare.ts` — Flare wallet connection + real transaction broadcasting
- `app/lib/ftso.ts` — live FTSOv2 on-chain oracle reads (registry-resolved)
- `app/lib/fdc.ts` — live FDC status + attested-verdict reads (Coston2)
- `contracts/FlavestAttestationRegistry.sol` — FDC Web2Json consumer contract
- `scripts/fdc/*.mjs` — deploy + end-to-end attestation flow
- `app/lib/ui.tsx` — CSS-string → React-style helper and icon set
- `app/globals.css` — Nocturne design tokens + component classes + Flavest animations
