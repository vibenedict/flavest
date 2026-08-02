"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { css, Ic, P } from "../lib/ui";
import { RISK, TOKENS, risk, srcStyle, TIER_LABEL, type Tier, type Token } from "../lib/data";
import { useFlareWallet, memoHex, type FlareNetwork } from "../lib/flare";
import { fetchFtsoPrices, type FtsoPrices } from "../lib/ftso";
import { fetchFdcStatus, fetchAttestedListing, COSTON2_EXPLORER, type FdcStatus, type AttestedListing } from "../lib/fdc";
import Background from "./Background";

// ── config (mirrors the design comp's data-props defaults) ──────────────────
const NETWORK: FlareNetwork = "Flare Mainnet";
const PAY_PER_ALERT_PRICE = 0.05;

type View = "feed" | "token" | "alerts" | "wallet" | "mobile" | "swap";
type Filter = "all" | "dex" | "cex" | "flare";
type SwapMode = "convert" | "buy" | "transfer";

type TxIntent = { to?: string; valueFlr: string | number; data?: string };
type Dialog = {
  title: string;
  label: string;
  amount: string;
  gas: string;
  total: string;
  toast?: string;
  onOk?: () => void;
  tx?: TxIntent;
  histType?: string;
  histDetail?: string;
};
type Toast = { title: string; msg: string; href?: string };
type TxRecord = { type: string; detail: string; amount: string; gas: string; hash: string; href?: string };

const HISTORY_KEY = "flavest:history:v1";
const HISTORY_MAX = 50;

// Illustrative prior activity, shown until the user signs their own transactions.
const SEED_HISTORY: TxRecord[] = [
  { type: "Subscription", detail: "Pro plan · monthly", amount: "15 FLR", gas: "0.0021", hash: "0x4a…9c2f" },
  { type: "Pay-per-alert", detail: "$NOVA delivery", amount: "0.05 FLR", gas: "0.0009", hash: "0x8f…c1a2" },
  { type: "Alert rule", detail: "Saved on-chain", amount: "—", gas: "0.0018", hash: "0x21…7ab0" },
  { type: "Deposit", detail: "Funded from exchange", amount: "+1,500 FLR", gas: "0.0011", hash: "0x0d…44e1" },
];

type Alerts = { cex: boolean; dex: boolean; flare: boolean; tg: boolean; app: boolean; wh: boolean; pay: boolean };

// ── style builders (ported from the comp) ───────────────────────────────────
const navBtn = (active: boolean) =>
  `display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 11px;border:0;border-radius:9px;cursor:pointer;font-family:var(--font-heading);font-size:13.5px;background:${active ? "color-mix(in srgb,var(--color-accent) 16%,transparent)" : "transparent"};color:${active ? "var(--color-accent-200)" : "var(--color-neutral-300)"}`;
const filBtn = (active: boolean) =>
  `padding:6px 12px;border-radius:8px;cursor:pointer;font-size:12.5px;font-family:var(--font-heading);border:1px solid ${active ? "var(--color-accent)" : "var(--color-divider)"};background:${active ? "color-mix(in srgb,var(--color-accent) 12%,transparent)" : "transparent"};color:${active ? "var(--color-accent-200)" : "var(--color-neutral-300)"}`;
const sw = (on: boolean) =>
  `position:relative;width:38px;height:22px;border-radius:12px;border:0;cursor:pointer;flex:none;transition:background .2s;background:${on ? "var(--color-accent)" : "var(--color-neutral-800)"}`;
const kn = (on: boolean) =>
  `position:absolute;top:3px;left:${on ? "19px" : "3px"};width:16px;height:16px;border-radius:50%;background:#f3f5fe;transition:left .2s`;
const ROW = "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border-radius:9px;background:color-mix(in srgb,var(--color-text) 3%,transparent);font-size:13.5px;cursor:pointer";

const IcOk = ({ ok }: { ok: boolean }) =>
  ok ? <Ic s={13} d={P.check} /> : <Ic s={13} d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z" />;

export default function FlavestApp() {
  const { wallet, connect, disconnect, send, explorerTxUrl } = useFlareWallet(NETWORK);

  const [view, setView] = useState<View>("feed");
  const [selId, setSelId] = useState("nova");
  const [filter, setFilter] = useState<Filter>("all");
  const [minSafety, setMinSafety] = useState(60);
  const [minLiq, setMinLiq] = useState(25);
  const [tier, setTier] = useState<Tier>("scout");
  const [staked, setStaked] = useState("0");

  const [sMode, setSMode] = useState<SwapMode>("convert");
  const [sAmount, setSAmount] = useState("50");
  const [sFrom, setSFrom] = useState("flr");
  const [sTo, setSTo] = useState("nova");
  const [sRecipient, setSRecipient] = useState("");

  const [al, setAl] = useState<Alerts>({ cex: true, dex: true, flare: true, tg: true, app: true, wh: false, pay: false });

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  // Initialised with the illustrative seed so SSR and first client render match
  // (avoids hydration mismatch); real persisted history is loaded after mount.
  const [history, setHistory] = useState<TxRecord[]>(SEED_HISTORY);
  const historyLoaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setHistory(parsed as TxRecord[]);
      }
    } catch {
      /* corrupt or unavailable storage — fall back to the seed */
    }
    historyLoaded.current = true;
  }, []);

  useEffect(() => {
    if (!historyLoaded.current) return;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      /* storage may be full or disabled — history stays in-memory */
    }
  }, [history]);

  // Live FTSOv2 oracle prices, read on-chain from Flare (no wallet needed).
  const [ftso, setFtso] = useState<FtsoPrices | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchFtsoPrices()
        .then((p) => alive && setFtso(p))
        .catch(() => {
          /* RPC/CORS hiccup — keep last good value / fall back to static */
        });
    load();
    const t = setInterval(load, 20000); // refresh every ~20s
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const flrUsdPrice = ftso?.FLR ?? 0.2131; // live FLR/USD, static fallback

  // Live FDC infrastructure status, resolved on-chain from Coston2 (no wallet).
  const [fdc, setFdc] = useState<FdcStatus | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetchFdcStatus().then((s) => alive && setFdc(s)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((t: Toast, ms = 3000) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  const doConnect = useCallback(async () => {
    await connect();
    setTier((t) => (t === "scout" ? "pro" : t));
  }, [connect]);

  const needWallet = useCallback(
    async (fn: () => void) => {
      if (!wallet.conn) await doConnect();
      fn();
    },
    [wallet.conn, doConnect],
  );

  const confirmDialog = useCallback(async () => {
    const d = dialog;
    if (!d || sending) return;

    // Real on-chain transaction when a genuine wallet is connected.
    if (d.tx && wallet.conn && !wallet.isDemo) {
      setSending(true);
      try {
        const hash = await send(d.tx);
        d.onOk?.();
        setHistory((h) => [
          {
            type: d.histType || "Transaction",
            detail: d.histDetail || d.label,
            amount: d.amount,
            gas: d.gas,
            hash: `${hash.slice(0, 6)}…${hash.slice(-4)}`,
            href: explorerTxUrl(hash),
          },
          ...h,
        ].slice(0, HISTORY_MAX));
        setDialog(null);
        showToast(
          {
            title: d.toast || "Transaction submitted",
            msg: `${hash.slice(0, 10)}…${hash.slice(-6)} · view on Flare explorer`,
            href: explorerTxUrl(hash),
          },
          6000,
        );
      } catch (err) {
        const code = (err as { code?: number })?.code;
        const msg =
          code === 4001
            ? "You rejected the transaction in your wallet."
            : (err as { message?: string })?.message || "Transaction failed.";
        showToast({ title: "Transaction not sent", msg }, 4500);
      } finally {
        setSending(false);
      }
      return;
    }

    // Simulated fallback (demo account / no injected wallet).
    d.onOk?.();
    const hash = "0x" + Math.random().toString(16).slice(2, 6) + "…" + Math.random().toString(16).slice(2, 6);
    setHistory((h) => [
      { type: d.histType || "Transaction", detail: d.histDetail || d.label, amount: d.amount, gas: `${d.gas} (sim)`, hash },
      ...h,
    ].slice(0, HISTORY_MAX));
    setDialog(null);
    showToast({ title: d.toast || "Transaction confirmed", msg: `${hash} · gas ${d.gas} FLR (simulated)` }, 3600);
  }, [dialog, sending, wallet.conn, wallet.isDemo, send, explorerTxUrl, showToast]);

  // ── derived ────────────────────────────────────────────────────────────────
  const tokens = TOKENS;
  const sel = useMemo<Token>(() => tokens.find((t) => t.id === selId) ?? tokens[0], [tokens, selId]);
  const selR = risk(sel.safety);

  // FDC-attested safety verdict for the selected token (null unless attested on-chain).
  const [attested, setAttested] = useState<AttestedListing | null>(null);
  useEffect(() => {
    let alive = true;
    setAttested(null);
    fetchAttestedListing(sel.sym).then((a) => alive && setAttested(a)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [sel.sym]);

  const feed = useMemo(() => {
    return tokens
      .filter((t) => {
        if (filter === "dex" && t.source !== "DEX") return false;
        if (filter === "cex" && t.source !== "CEX") return false;
        if (filter === "flare" && t.chain !== "Flare") return false;
        return t.safety >= minSafety;
      })
      .map((t) => {
        const r = risk(t.safety);
        return { ...t, riskColor: r.color, safetyPct: t.safety + "%", src: srcStyle(t.source) };
      });
  }, [tokens, filter, minSafety]);

  const checks = useMemo(
    () =>
      [
        { label: "Honeypot simulation", note: "Buy + sell simulated on a fork", ok: sel.honeypot },
        { label: "Liquidity locked", note: sel.lock, ok: sel.lpLocked },
        { label: "Ownership renounced", note: "Owner cannot alter the contract", ok: sel.renounced },
        { label: "Mint function disabled", note: "Supply cannot be inflated", ok: sel.mintOff },
        { label: "LP tokens burned", note: "Liquidity cannot be pulled", ok: sel.lpBurned },
        { label: "No blacklist / fee trap", note: "Transfer + tax functions clean", ok: sel.safety > 50 },
      ].map((c) => ({
        ...c,
        verdict: c.ok ? "Pass" : "Fail",
        color: c.ok ? RISK.safe : RISK.danger,
        bg: c.ok ? "rgba(78,168,154,.15)" : "rgba(201,106,106,.15)",
      })),
    [sel],
  );

  const flrUsd = useMemo(() => {
    const n = parseFloat(wallet.balance.replace(/,/g, "")) || 0;
    return "$" + (n * flrUsdPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [wallet.balance, flrUsdPrice]);

  const titles: Record<View, [string, string]> = {
    feed: ["Live Feed", "New CEX listings and DEX pairs, safety-scored in real time"],
    token: [sel.sym + " · Safety Report", "Full anti-rug analysis, verified on Flare"],
    alerts: ["Alerts & Filters", "Only what clears your rules — pushed and recorded on-chain"],
    wallet: ["Wallet & Billing", "Subscriptions, staking and pay-per-alert on Flare"],
    mobile: ["Mobile Preview", "Push alerts and Telegram delivery on the go"],
    swap: ["Swap & Transfer", "Convert, buy and send tokens — settled on Flare"],
  };
  const [pageTitle, pageSub] = titles[view];

  // subscription tier helpers
  const tierBtn = (k: Tier) =>
    tier === k
      ? "width:100%;margin-top:auto;padding:9px;border-radius:8px;border:1px solid var(--color-divider);background:transparent;color:var(--color-neutral-500);cursor:default;font-family:var(--font-heading);font-size:13px"
      : "width:100%;margin-top:auto;padding:9px;border-radius:8px;border:1px solid var(--color-accent);background:color-mix(in srgb,var(--color-accent) 12%,transparent);color:var(--color-accent);cursor:pointer;font-family:var(--font-heading);font-size:13px";
  const tierCard = (k: Tier) =>
    `position:relative;display:flex;flex-direction:column;gap:6px;padding:18px;border-radius:12px;background:var(--color-surface);box-shadow:${tier === k ? "0 0 0 1px var(--color-accent),0 6px 18px rgba(0,0,0,.5)" : "var(--shadow-sm)"}`;
  const tierLbl = (k: Tier) => (tier === k ? "Current plan" : k === "scout" ? "Downgrade" : "Upgrade");
  const subscribe = (k: Tier, price: number) => () =>
    needWallet(() =>
      setDialog({
        title: "Subscribe · " + TIER_LABEL[k],
        label: TIER_LABEL[k] + " monthly",
        amount: price + " FLR",
        gas: "0.0021",
        total: (price + 0.0021).toFixed(4) + " FLR",
        toast: "Subscribed to " + TIER_LABEL[k],
        onOk: () => setTier(k),
        tx: { valueFlr: 0, data: memoHex("flavest:subscribe:" + k) },
        histType: "Subscription",
        histDetail: TIER_LABEL[k] + " plan · monthly",
      }),
    );

  const ruleSummary = `Alert me on ${[al.cex && "CEX listings", al.dex && "DEX pairs", al.flare && "Flare launches"].filter(Boolean).join(", ") || "no sources"} with ≥ $${minLiq}k liquidity and safety ≥ ${minSafety}, delivered via ${[al.tg && "Telegram", al.app && "in-app", al.wh && "webhook"].filter(Boolean).join(", ") || "no channel"}.`;

  // ── swap panel derived values ────────────────────────────────────────────
  const USD: Record<string, number> = { flr: flrUsdPrice, usdt: 1 };
  const tPrice = (id: string) => {
    const t = tokens.find((x) => x.id === id);
    return t ? parseFloat(t.price.replace(/[$,]/g, "")) || 0 : 0;
  };
  const tSym = (id: string) => tokens.find((x) => x.id === id)?.sym ?? id;
  const payOpts = [
    { id: "flr", label: "FLR" },
    { id: "usdt", label: "USD₮" },
  ];
  const tokOpts = tokens.map((t) => ({ id: t.id, label: t.sym }));
  const amt = parseFloat(sAmount) || 0;
  const fromSym = sFrom === "usdt" ? "USD₮" : "FLR";
  const fromPrice = USD[sFrom] || 0;
  const usdVal = amt * fromPrice;
  const toP = tPrice(sTo) || 1;
  const recv = usdVal / toP;
  const recvFmt = (recv >= 1 ? recv.toLocaleString(undefined, { maximumFractionDigits: 2 }) : recv.toPrecision(4)) + " " + tSym(sTo);
  const rateVal = `1 ${fromSym} = ${(fromPrice / toP).toPrecision(4)} ${tSym(sTo)}`;
  const swapExplain: Record<SwapMode, string> = {
    convert:
      "Your order is routed through the Flavest aggregator across SparkDEX and Enosys pools. FTSOv2 supplies the reference price so you can see slippage before signing. One on-chain swap, gas in FLR.",
    buy: "You pay in FLR or bridged USD₮ and receive the token in the same wallet. The buy executes against on-chain liquidity on Flare and the fill price is anchored to the FTSOv2 feed.",
    transfer:
      "A direct token transfer to any Flare address. Signed once from your wallet; the recipient receives it in the same block. Gas is paid in FLR and the transfer is irreversible.",
  };
  const execSwap = () =>
    needWallet(() => {
      const gas = sMode === "transfer" ? "0.0009" : "0.0031";
      if (sMode === "transfer") {
        // A real transfer needs a valid recipient and a positive amount.
        if (wallet.conn && !wallet.isDemo) {
          if (!/^0x[0-9a-fA-F]{40}$/.test(sRecipient.trim())) {
            showToast({ title: "Invalid recipient", msg: "Enter a full 0x… Flare address to send." }, 4000);
            return;
          }
          if (!(amt > 0)) {
            showToast({ title: "Enter an amount", msg: "Transfer amount must be greater than zero." }, 4000);
            return;
          }
        }
        setDialog({
          title: "Send " + fromSym,
          label: "To " + (sRecipient || "0x…recipient"),
          amount: amt + " " + fromSym,
          gas,
          total: amt + " " + fromSym + " + " + gas + " FLR",
          toast: "Sent " + amt + " " + fromSym,
          // FLR transfers move real value to the recipient. Bridged USD₮ is an
          // ERC-20 (no token contract wired here), so send it as a native
          // memo tx recorded on-chain rather than a fake ERC-20 transfer.
          tx:
            sFrom === "usdt"
              ? { to: sRecipient.trim(), valueFlr: 0, data: memoHex("flavest:transfer:usdt:" + amt) }
              : { to: sRecipient.trim(), valueFlr: amt },
          histType: "Transfer",
          histDetail: "To " + (sRecipient ? sRecipient.slice(0, 6) + "…" + sRecipient.slice(-4) : "recipient"),
        });
      } else if (sMode === "buy") {
        setDialog({ title: "Buy " + tSym(sTo), label: "Pay " + amt + " " + fromSym, amount: "≈ " + recvFmt, gas, total: amt + " " + fromSym + " + " + gas + " FLR", toast: "Bought " + recvFmt, tx: { valueFlr: 0, data: memoHex("flavest:buy:" + sTo + ":" + amt) }, histType: "Buy", histDetail: tSym(sTo) + " · pay " + amt + " " + fromSym });
      } else {
        setDialog({ title: "Convert " + fromSym + " → " + tSym(sTo), label: "Swap " + amt + " " + fromSym, amount: "≈ " + recvFmt, gas, total: amt + " " + fromSym + " + " + gas + " FLR", toast: "Swapped to " + recvFmt, tx: { valueFlr: 0, data: memoHex("flavest:convert:" + sFrom + ":" + sTo + ":" + amt) }, histType: "Swap", histDetail: fromSym + " → " + tSym(sTo) });
      }
    });

  const flrBalance = wallet.conn ? wallet.balance : "1,240.5";
  const fromBal = sFrom === "usdt" ? "318.40 USD₮" : `${flrBalance} FLR`;
  const mobileFeed = tokens.slice(0, 5).map((t) => ({ ...t, riskColor: risk(t.safety).color }));
  const fmtUsd = (v: number) => (v >= 1 ? "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "$" + v.toFixed(4));

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div style={css("position:relative;display:flex;height:100vh;min-height:760px;overflow:hidden;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)")}>
      <Background />

      {/* ══ SIDEBAR ══ */}
      <aside style={css("position:relative;z-index:1;width:236px;flex:none;display:flex;flex-direction:column;padding:18px 14px;border-right:1px solid var(--color-divider);background:linear-gradient(180deg,rgba(24,26,41,.93),rgba(19,21,33,.95))")}>
        <div style={css("display:flex;align-items:center;gap:9px;padding:0 6px 4px")}>
          <div style={css("width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--color-accent),#5d5294);display:grid;place-items:center;flex:none;box-shadow:0 0 14px rgba(145,132,217,.4)")}>
            <Ic s={16} d={P.lightning} fill="#161826" />
          </div>
          <div style={css("line-height:1.05")}>
            <div style={css("font-family:var(--font-heading);font-weight:600;font-size:17px;letter-spacing:-.02em")}>Flavest</div>
            <div style={css("font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--color-neutral-500)")}>Launch Radar</div>
          </div>
        </div>

        <div style={css("margin:16px 0 6px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--color-neutral-600);padding:0 6px")}>Workspace</div>
        <nav style={css("display:flex;flex-direction:column;gap:2px")}>
          <button onClick={() => setView("feed")} style={css(navBtn(view === "feed"))}>
            <svg width="17" height="17" viewBox="0 0 256 256" fill="currentColor" aria-hidden><path d={P.feed} /><path d={P.feedRows} /></svg>
            <span>Live Feed</span>
            <span style={css("margin-left:auto;font-size:10.5px;padding:1px 7px;border-radius:9px;background:var(--color-accent-800);color:var(--color-accent-100)")}>12</span>
          </button>
          <button onClick={() => setView("alerts")} style={css(navBtn(view === "alerts"))}>
            <Ic s={17} d={P.bell} /><span>Alerts &amp; Filters</span>
          </button>
          <button onClick={() => setView("wallet")} style={css(navBtn(view === "wallet"))}>
            <Ic s={17} d={P.wallet} /><span>Wallet &amp; Billing</span>
          </button>
          <button onClick={() => setView("swap")} style={css(navBtn(view === "swap"))}>
            <Ic s={17} d={P.swap} /><span>Swap &amp; Transfer</span>
          </button>
          <button onClick={() => setView("mobile")} style={css(navBtn(view === "mobile"))}>
            <Ic s={17} d={P.phone} /><span>Mobile Preview</span>
          </button>
        </nav>

        <div style={css("margin:18px 0 6px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--color-neutral-600);padding:0 6px")}>Detection engine</div>
        <div style={css("padding:10px 12px;border-radius:10px;background:var(--color-surface);box-shadow:var(--shadow-sm);display:flex;flex-direction:column;gap:8px")}>
          <div style={css("display:flex;justify-content:space-between;align-items:center;font-size:12px")}>
            <span style={css("display:flex;align-items:center;gap:6px")}><span style={css("width:7px;height:7px;border-radius:50%;background:#4ea89a;animation:flvpulse 1.6s infinite")} />CEX websockets</span>
            <span style={css("color:var(--color-neutral-500)")}>4</span>
          </div>
          <div style={css("display:flex;justify-content:space-between;align-items:center;font-size:12px")}>
            <span style={css("display:flex;align-items:center;gap:6px")}><span style={css("width:7px;height:7px;border-radius:50%;background:#4ea89a;animation:flvpulse 1.6s .3s infinite")} />DEX pair indexers</span>
            <span style={css("color:var(--color-neutral-500)")}>6</span>
          </div>
          <div style={css("display:flex;justify-content:space-between;align-items:center;font-size:12px")}>
            <span style={css("display:flex;align-items:center;gap:6px")}><span style={css("width:7px;height:7px;border-radius:50%;background:var(--color-accent);animation:flvpulse 1.6s .6s infinite")} />Flare FDC relayer</span>
            <span style={css("color:var(--color-neutral-500)")}>live</span>
          </div>
        </div>

        <div style={css("margin-top:auto")} />
        {wallet.conn ? (
          <div style={css("padding:11px 12px;border-radius:10px;background:var(--color-surface);box-shadow:var(--shadow-sm)")}>
            <div style={css("display:flex;align-items:center;gap:8px")}>
              <div style={css("width:26px;height:26px;border-radius:50%;background:conic-gradient(from 140deg,#9184d9,#e6224a,#9184d9);flex:none")} />
              <div style={css("line-height:1.15;flex:1;min-width:0")}>
                <div style={css("font-size:12.5px;font-family:var(--font-heading)")}>{wallet.addrShort}</div>
                <div style={css("font-size:10.5px;color:var(--color-neutral-500)")}>{wallet.networkName}</div>
              </div>
            </div>
            <div style={css("display:flex;justify-content:space-between;margin-top:9px;font-size:12px")}>
              <span style={css("color:var(--color-neutral-500)")}>Balance</span>
              <span style={css("font-family:var(--font-heading)")}>{flrBalance} FLR</span>
            </div>
            <div style={css("display:flex;align-items:center;justify-content:space-between;margin-top:6px")}>
              <span className="tag tag-accent">{TIER_LABEL[tier]}</span>
              <button onClick={disconnect} className="btn btn-ghost" style={css("font-size:11px")}>Disconnect</button>
            </div>
          </div>
        ) : (
          <button onClick={doConnect} className="btn btn-primary btn-block" style={css("margin-top:0")}>
            <Ic s={15} d={P.wallet} /> Connect Wallet
          </button>
        )}
      </aside>

      {/* ══ MAIN ══ */}
      <main style={css("position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden")}>
        <header style={css("display:flex;align-items:center;gap:16px;padding:15px 26px;border-bottom:1px solid var(--color-divider);flex:none;background:rgba(20,22,34,.86)")}>
          <div style={css("min-width:0")}>
            <h4 style={css("margin:0;font-size:19px")}>{pageTitle}</h4>
            <div style={css("font-size:12.5px;color:var(--color-neutral-500)")}>{pageSub}</div>
          </div>
          <div style={css("margin-left:auto;display:flex;align-items:center;gap:12px")}>
            <div
              title={ftso ? `FTSOv2 read on-chain · FtsoV2 ${ftso.ftsoV2} · oracle ts ${ftso.timestamp}` : "Reading FTSOv2 on-chain from Flare…"}
              style={css("display:flex;align-items:center;gap:8px;font-size:12px;padding:6px 11px;border-radius:20px;background:var(--color-surface);box-shadow:var(--shadow-sm)")}
            >
              <span style={css(`width:8px;height:8px;border-radius:50%;background:${ftso ? "var(--color-accent)" : "var(--color-neutral-600)"};animation:flvpulse 1.6s infinite`)} />
              <span style={css("color:var(--color-neutral-400)")}>FTSOv2</span>
              {ftso ? (
                <span style={css("display:flex;gap:8px;font-family:var(--font-heading)")}>
                  <span style={css("color:var(--color-text)")}>FLR {fmtUsd(ftso.FLR)}</span>
                  <span style={css("color:var(--color-neutral-500)")}>BTC {fmtUsd(ftso.BTC)}</span>
                  <span style={css("color:var(--color-neutral-500)")}>ETH {fmtUsd(ftso.ETH)}</span>
                </span>
              ) : (
                <span style={css("color:var(--color-neutral-500)")}>reading…</span>
              )}
            </div>
            <div style={css("display:flex;align-items:center;gap:7px;font-size:12.5px;padding:6px 11px;border-radius:20px;background:var(--color-surface);box-shadow:var(--shadow-sm)")}>
              <span style={css("width:8px;height:8px;border-radius:50%;background:#4ea89a;animation:flvpulse 1.4s infinite")} />
              <span style={css("color:var(--color-neutral-400)")}>Detecting · avg <b style={css("color:var(--color-text)")}>312ms</b></span>
            </div>
            {wallet.conn ? (
              <div style={css("display:flex;align-items:center;gap:8px;padding:5px 6px 5px 12px;border-radius:20px;box-shadow:var(--shadow-sm)")}>
                <span style={css("font-size:12.5px;color:var(--color-neutral-400)")}>{flrBalance} FLR</span>
                <span style={css("width:26px;height:26px;border-radius:50%;background:conic-gradient(from 140deg,#9184d9,#e6224a,#9184d9)")} />
              </div>
            ) : (
              <button onClick={doConnect} className="btn btn-primary">Connect Wallet</button>
            )}
          </div>
        </header>

        <div style={css("flex:1;overflow-y:auto;padding:22px 26px 40px")}>
          {/* ═══ FEED ═══ */}
          {view === "feed" && (
            <div style={css("animation:flvslide .3s ease")}>
              <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px")}>
                <div className="card elev-sm" style={css("gap:2px;box-shadow:var(--shadow-sm),inset 0 2px 0 #a78bfa")}><div style={css("font-size:11px;color:var(--color-neutral-500)")}>Pairs detected · 24h</div><div style={css("font-size:26px;font-family:var(--font-heading);color:#c4b5fd")}>1,284</div><div style={css("font-size:11px;color:#34d399")}>+18% vs avg</div></div>
                <div className="card elev-sm" style={css("gap:2px;box-shadow:var(--shadow-sm),inset 0 2px 0 #38bdf8")}><div style={css("font-size:11px;color:var(--color-neutral-500)")}>Alerts delivered</div><div style={css("font-size:26px;font-family:var(--font-heading);color:#7dd3fc")}>96</div><div style={css("font-size:11px;color:var(--color-neutral-500)")}>on-chain receipts</div></div>
                <div className="card elev-sm" style={css("gap:2px;box-shadow:var(--shadow-sm),inset 0 2px 0 #34d399")}><div style={css("font-size:11px;color:var(--color-neutral-500)")}>Median detect latency</div><div style={css("font-size:26px;font-family:var(--font-heading);color:#6ee7b7")}>312<span style={css("font-size:14px;color:var(--color-neutral-500)")}>ms</span></div><div style={css("font-size:11px;color:#34d399")}>sub-block</div></div>
                <div className="card elev-sm" style={css("gap:2px;box-shadow:var(--shadow-sm),inset 0 2px 0 #ff4d6d")}><div style={css("font-size:11px;color:var(--color-neutral-500)")}>Rugs / honeypots filtered</div><div style={css("font-size:26px;font-family:var(--font-heading);color:#ff8fa3")}>341</div><div style={css("font-size:11px;color:#ff6b81")}>blocked pre-alert</div></div>
              </div>

              <div style={css("display:flex;align-items:center;gap:14px;margin-bottom:12px;flex-wrap:wrap")}>
                <div style={css("display:flex;gap:6px")}>
                  <button onClick={() => setFilter("all")} style={css(filBtn(filter === "all"))}>All sources</button>
                  <button onClick={() => setFilter("dex")} style={css(filBtn(filter === "dex"))}>DEX pairs</button>
                  <button onClick={() => setFilter("cex")} style={css(filBtn(filter === "cex"))}>CEX listings</button>
                  <button onClick={() => setFilter("flare")} style={css(filBtn(filter === "flare"))}>Flare native</button>
                </div>
                <div style={css("margin-left:auto;display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--color-neutral-400)")}>
                  <span>Min safety</span>
                  <input type="range" min={0} max={100} step={5} value={minSafety} onChange={(e) => setMinSafety(+e.target.value)} style={css("width:130px")} />
                  <b style={css("font-family:var(--font-heading);width:26px;text-align:right;color:var(--color-text)")}>{minSafety}</b>
                </div>
              </div>

              <div style={css("border-radius:12px;background:var(--color-surface);box-shadow:var(--shadow-sm);overflow:hidden")}>
                <table className="table">
                  <thead><tr>
                    <th style={css("padding-left:18px")}>Token</th><th>Source</th><th>Chain</th><th style={css("text-align:right")}>Liquidity</th><th style={css("text-align:right")}>Price</th><th>Detected</th><th>Safety</th><th style={css("width:20px")} />
                  </tr></thead>
                  <tbody>
                    {feed.map((t) => (
                      <tr key={t.id} onClick={() => { setSelId(t.id); setView("token"); }} style={css("cursor:pointer")}>
                        <td style={css("padding-left:18px")}>
                          <div style={css("display:flex;align-items:center;gap:10px")}>
                            <div style={css(`width:30px;height:30px;border-radius:8px;background:${t.iconBg};display:grid;place-items:center;font-size:12px;font-family:var(--font-heading);color:#f3f5fe;flex:none`)}>{t.mono}</div>
                            <div style={css("line-height:1.15")}><div style={css("font-family:var(--font-heading);font-size:14px")}>{t.sym}</div><div style={css("font-size:11px;color:var(--color-neutral-500)")}>{t.name}</div></div>
                          </div>
                        </td>
                        <td><span style={css(t.src)}>{t.source}</span> <span style={css("font-size:11px;color:var(--color-neutral-500)")}>{t.venue}</span></td>
                        <td><span style={css("display:inline-flex;align-items:center;gap:6px;font-size:13px")}><span style={css(`width:8px;height:8px;border-radius:50%;background:${t.chainColor}`)} />{t.chain}</span></td>
                        <td style={css("text-align:right;font-variant-numeric:tabular-nums")}>{t.liq}</td>
                        <td style={css("text-align:right;font-variant-numeric:tabular-nums")}>{t.price}</td>
                        <td style={css("font-size:12.5px;color:var(--color-neutral-400)")}>{t.age}</td>
                        <td>
                          <span style={css("display:inline-flex;align-items:center;gap:7px")}>
                            <span style={css("width:34px;height:6px;border-radius:4px;background:var(--color-neutral-800);overflow:hidden;display:inline-block")}><span style={css(`display:block;height:100%;width:${t.safetyPct};background:${t.riskColor}`)} /></span>
                            <span style={css(`font-size:12.5px;font-family:var(--font-heading);color:${t.riskColor}`)}>{t.safety}</span>
                          </span>
                        </td>
                        <td style={css("color:var(--color-neutral-600)")}><Ic s={15} d={P.caretRight} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={css("margin-top:10px;font-size:11.5px;color:var(--color-neutral-600);display:flex;align-items:center;gap:6px")}>
                <Ic s={13} d={P.info} />
                Every alert is filtered by the Safety Engine and its verdict is attested on Flare via the Data Connector before it reaches you.
              </div>
            </div>
          )}

          {/* ═══ TOKEN DETAIL ═══ */}
          {view === "token" && (
            <div style={css("animation:flvslide .3s ease;max-width:1040px")}>
              <button onClick={() => setView("feed")} className="btn btn-ghost" style={css("margin-bottom:14px;font-size:13px")}>
                <Ic s={15} d={P.arrowLeft} /> Back to feed
              </button>

              <div style={css("display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap;margin-bottom:20px")}>
                <div style={css(`width:60px;height:60px;border-radius:14px;background:${sel.iconBg};display:grid;place-items:center;font-size:22px;font-family:var(--font-heading);color:#f3f5fe;flex:none`)}>{sel.mono}</div>
                <div style={css("flex:1;min-width:220px")}>
                  <div style={css("display:flex;align-items:center;gap:12px;flex-wrap:wrap")}>
                    <h2 style={css("margin:0;font-size:30px")}>{sel.sym}</h2>
                    <span style={css(srcStyle(sel.source))}>{sel.source}</span>
                    <span style={css("display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--color-neutral-400)")}><span style={css(`width:8px;height:8px;border-radius:50%;background:${sel.chainColor}`)} />{sel.chain} · {sel.venue}</span>
                  </div>
                  <div style={css("color:var(--color-neutral-500);font-size:14px;margin-top:2px")}>{sel.name} · contract {sel.contract}</div>
                </div>
                <div style={css("text-align:right")}>
                  <div style={css("font-size:11px;color:var(--color-neutral-500)")}>Price (FTSOv2 anchored)</div>
                  <div style={css("font-size:26px;font-family:var(--font-heading)")}>{sel.price}</div>
                  <div style={css("font-size:12px;color:var(--color-neutral-400)")}>Detected {sel.age} ago</div>
                </div>
              </div>

              <div style={css("display:grid;grid-template-columns:1.3fr 1fr;gap:16px;align-items:start")}>
                <div className="card elev-sm" style={css("gap:14px;padding:18px")}>
                  <div style={css("display:flex;align-items:center;justify-content:space-between")}>
                    <div><div className="card-kicker">Safety &amp; Anti-rug Report</div><div style={css("font-size:12px;color:var(--color-neutral-500)")}>Static + dynamic contract analysis</div></div>
                    <div style={css("display:flex;align-items:center;gap:12px")}>
                      <div style={css("text-align:right")}><div style={css(`font-size:30px;font-family:var(--font-heading);color:${selR.color};line-height:1`)}>{sel.safety}</div><div style={css(`font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:${selR.color}`)}>{selR.label}</div></div>
                      <svg width="46" height="46" viewBox="0 0 44 44" aria-hidden><circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-neutral-800)" strokeWidth="5" /><circle cx="22" cy="22" r="18" fill="none" stroke={selR.color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${Math.round((sel.safety / 100) * 113)} 113`} transform="rotate(-90 22 22)" /></svg>
                    </div>
                  </div>
                  <div style={css("display:flex;flex-direction:column;gap:1px")}>
                    {checks.map((c) => (
                      <div key={c.label} style={css("display:flex;align-items:center;gap:11px;padding:9px 2px;border-bottom:1px solid var(--color-divider)")}>
                        <span style={css(`width:22px;height:22px;border-radius:6px;display:grid;place-items:center;flex:none;background:${c.bg};color:${c.color}`)}><IcOk ok={c.ok} /></span>
                        <div style={css("flex:1")}><div style={css("font-size:13.5px")}>{c.label}</div><div style={css("font-size:11.5px;color:var(--color-neutral-500)")}>{c.note}</div></div>
                        <span style={css(`font-size:12px;font-family:var(--font-heading);color:${c.color}`)}>{c.verdict}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={css("display:flex;flex-direction:column;gap:16px")}>
                  <div className="card elev-sm" style={css("gap:11px;padding:18px")}>
                    <div style={css("display:flex;align-items:center;gap:8px")}><span style={css("width:8px;height:8px;border-radius:50%;background:#e6224a")} /><div className="card-kicker" style={css("color:#e6a0af")}>Verified on Flare</div></div>
                    <div style={css("display:flex;justify-content:space-between;font-size:13px")}><span style={css("color:var(--color-neutral-400)")}>FTSOv2 price feed</span><span style={css("display:flex;gap:6px;align-items:center;color:#4ea89a")}><Ic s={13} d={P.check} /> anchored</span></div>
                    <div style={css("display:flex;justify-content:space-between;font-size:13px")}><span style={css("color:var(--color-neutral-400)")}>FDC safety attestation</span>{attested ? <span style={css("display:flex;gap:6px;align-items:center;color:#4ea89a")}><Ic s={13} d={P.check} /> attested · round {attested.votingRound}</span> : <span style={css("color:var(--color-neutral-500)")}>{fdc ? "FDC live · round " + fdc.votingRound : "resolving…"}</span>}</div>
                    <div style={css("display:flex;justify-content:space-between;font-size:13px")}><span style={css("color:var(--color-neutral-400)")}>FDC verifier (Coston2)</span>{fdc ? <a href={`${COSTON2_EXPLORER}/address/${fdc.fdcVerification}`} target="_blank" rel="noopener noreferrer" style={css("font-family:var(--font-heading);color:var(--color-accent-300)")}>{fdc.fdcVerification.slice(0, 6)}…{fdc.fdcVerification.slice(-4)}</a> : <span style={css("color:var(--color-neutral-500)")}>…</span>}</div>
                    <div style={css("display:flex;justify-content:space-between;font-size:13px")}><span style={css("color:var(--color-neutral-400)")}>Alert receipt tx</span><span style={css("font-family:var(--font-heading);color:var(--color-accent-300)")}>{sel.receipt}</span></div>
                    <div style={css("font-size:11px;color:var(--color-neutral-600);border-top:1px solid var(--color-divider);padding-top:9px")}>The safety verdict is fetched off-chain, attested by Flare&apos;s Data Connector via the <b>Web2Json</b> type, and verified on-chain by the FDC verifier above through <code>FlavestAttestationRegistry</code> — so an alert is provably not fabricated.</div>
                  </div>
                  <div className="card elev-sm" style={css("gap:9px;padding:18px")}>
                    <div className="card-kicker">Market</div>
                    <div style={css("display:flex;justify-content:space-between;font-size:13px")}><span style={css("color:var(--color-neutral-400)")}>Liquidity</span><span style={css("font-family:var(--font-heading)")}>{sel.liq}</span></div>
                    <div style={css("display:flex;justify-content:space-between;font-size:13px")}><span style={css("color:var(--color-neutral-400)")}>Fully diluted mcap</span><span style={css("font-family:var(--font-heading)")}>{sel.mcap}</span></div>
                    <div style={css("display:flex;justify-content:space-between;font-size:13px")}><span style={css("color:var(--color-neutral-400)")}>Holders</span><span style={css("font-family:var(--font-heading)")}>{sel.holders}</span></div>
                    <div style={css("display:flex;justify-content:space-between;font-size:13px")}><span style={css("color:var(--color-neutral-400)")}>LP locked until</span><span style={css("font-family:var(--font-heading)")}>{sel.lock}</span></div>
                  </div>
                </div>
              </div>

              <div style={css("display:flex;gap:10px;margin-top:18px;flex-wrap:wrap")}>
                <button onClick={() => needWallet(() => setDialog({ title: "Trade " + sel.sym, label: "Swap 50 FLR → " + sel.sym, amount: "50 FLR", gas: "0.0034", total: "50.0034 FLR", toast: "Swap confirmed · " + sel.sym, tx: { valueFlr: 0, data: memoHex("flavest:trade:" + sel.id) }, histType: "Trade", histDetail: "Swap 50 FLR → " + sel.sym }))} className="btn btn-primary"><Ic s={15} d={P.check} />Trade now · charges gas</button>
                <button onClick={() => showToast({ title: "Tracking " + sel.sym, msg: "Added to your watchlist" })} className="btn btn-secondary">Track token</button>
                <button onClick={() => setView("alerts")} className="btn btn-secondary">Create alert rule</button>
              </div>
            </div>
          )}

          {/* ═══ ALERTS ═══ */}
          {view === "alerts" && (
            <div style={css("animation:flvslide .3s ease;max-width:920px;display:grid;grid-template-columns:1.2fr .9fr;gap:16px;align-items:start")}>
              <div className="card elev-sm" style={css("padding:20px;gap:18px")}>
                <div><div className="card-kicker">Alert rule</div><div style={css("font-size:13px;color:var(--color-neutral-500)")}>Only listings that clear every filter are pushed and written on-chain.</div></div>

                <div>
                  <div style={css("font-size:12px;color:var(--color-neutral-400);margin-bottom:8px")}>Sources</div>
                  <div style={css("display:flex;flex-direction:column;gap:8px")}>
                    <label style={css(ROW)}><span>CEX listing announcements <span style={css("color:var(--color-neutral-500);font-size:11.5px")}>Binance · OKX · KuCoin</span></span><button onClick={() => setAl((a) => ({ ...a, cex: !a.cex }))} style={css(sw(al.cex))}><span style={css(kn(al.cex))} /></button></label>
                    <label style={css(ROW)}><span>DEX new liquidity pairs <span style={css("color:var(--color-neutral-500);font-size:11.5px")}>Raydium · Pancake · SparkDEX</span></span><button onClick={() => setAl((a) => ({ ...a, dex: !a.dex }))} style={css(sw(al.dex))}><span style={css(kn(al.dex))} /></button></label>
                    <label style={css(ROW)}><span>Flare-native launches <span style={css("color:var(--color-neutral-500);font-size:11.5px")}>Enosys · SparkDEX · FTSO listings</span></span><button onClick={() => setAl((a) => ({ ...a, flare: !a.flare }))} style={css(sw(al.flare))}><span style={css(kn(al.flare))} /></button></label>
                  </div>
                </div>

                <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:16px")}>
                  <div>
                    <div style={css("display:flex;justify-content:space-between;font-size:12px;color:var(--color-neutral-400);margin-bottom:8px")}>Min liquidity <b style={css("color:var(--color-text)")}>${minLiq}k</b></div>
                    <input type="range" min={0} max={500} step={5} value={minLiq} onChange={(e) => setMinLiq(+e.target.value)} style={css("width:100%")} />
                  </div>
                  <div>
                    <div style={css("display:flex;justify-content:space-between;font-size:12px;color:var(--color-neutral-400);margin-bottom:8px")}>Min safety score <b style={css("color:var(--color-text)")}>{minSafety}</b></div>
                    <input type="range" min={0} max={100} step={5} value={minSafety} onChange={(e) => setMinSafety(+e.target.value)} style={css("width:100%")} />
                  </div>
                </div>

                <div>
                  <div style={css("font-size:12px;color:var(--color-neutral-400);margin-bottom:8px")}>Delivery</div>
                  <div style={css("display:flex;flex-direction:column;gap:8px")}>
                    <label style={css(ROW)}><span style={css("display:flex;align-items:center;gap:8px")}><svg width="16" height="16" viewBox="0 0 240 240" fill="#2AABEE" aria-hidden><circle cx="120" cy="120" r="120" /><path d="M181 71 158 187c-2 8-6 10-13 6l-35-26-17 16c-2 2-4 4-7 4l3-36 65-59c3-2-1-4-4-2l-80 50-35-11c-8-2-8-8 2-11l137-53c6-2 12 2 8 12Z" fill="#fff" /></svg>Telegram bot</span><button onClick={() => setAl((a) => ({ ...a, tg: !a.tg }))} style={css(sw(al.tg))}><span style={css(kn(al.tg))} /></button></label>
                    <label style={css(ROW)}><span style={css("display:flex;align-items:center;gap:8px")}><Ic s={16} d={P.bellSolid} fill="var(--color-accent-300)" />In-app + browser push</span><button onClick={() => setAl((a) => ({ ...a, app: !a.app }))} style={css(sw(al.app))}><span style={css(kn(al.app))} /></button></label>
                    <label style={css(ROW)}><span style={css("display:flex;align-items:center;gap:8px")}><Ic s={16} d={P.eye} fill="var(--color-neutral-400)" />Webhook / API</span><button onClick={() => setAl((a) => ({ ...a, wh: !a.wh }))} style={css(sw(al.wh))}><span style={css(kn(al.wh))} /></button></label>
                  </div>
                </div>

                <button onClick={() => needWallet(() => setDialog({ title: "Save alert rule", label: "Write rule to Flare", amount: "—", gas: "0.0018", total: "0.0018 FLR", toast: "Alert rule saved on-chain", tx: { valueFlr: 0, data: memoHex("flavest:alert-rule") }, histType: "Alert rule", histDetail: "Saved on-chain" }))} className="btn btn-primary btn-block">Save rule on-chain · ~0.0018 FLR gas</button>
              </div>

              <div style={css("display:flex;flex-direction:column;gap:16px")}>
                <div className="card elev-sm" style={css("padding:18px;gap:10px")}>
                  <div className="card-kicker">Pay-per-alert</div>
                  <label style={css(ROW + ";background:transparent;padding:0")}><span style={css("font-size:13.5px")}>Charge per delivered alert</span><button onClick={() => setAl((a) => ({ ...a, pay: !a.pay }))} style={css(sw(al.pay))}><span style={css(kn(al.pay))} /></button></label>
                  <div style={css("font-size:12px;color:var(--color-neutral-500)")}>When on, each alert triggers a {PAY_PER_ALERT_PRICE} FLR micro-payment at delivery, settled on Flare. Off with a subscription tier.</div>
                </div>
                <div className="card elev-sm" style={css("padding:18px;gap:8px")}>
                  <div className="card-kicker">Rule preview</div>
                  <div style={css("font-size:13px;line-height:1.6;color:var(--color-neutral-300)")}>{ruleSummary}</div>
                  <div style={css("font-size:11.5px;color:var(--color-neutral-600);border-top:1px solid var(--color-divider);padding-top:9px")}>Est. matches: <b style={css("color:var(--color-text)")}>~{al.pay ? "6" : "11"}/day</b></div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ WALLET ═══ */}
          {view === "wallet" && (
            <div style={css("animation:flvslide .3s ease;max-width:1000px")}>
              {!wallet.conn ? (
                <div className="card elev-sm" style={css("padding:40px;align-items:center;text-align:center;gap:10px;max-width:420px;margin:40px auto")}>
                  <div style={css("width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,var(--color-accent),#5d5294);display:grid;place-items:center")}><Ic s={26} d={P.wallet} fill="#161826" /></div>
                  <h4 style={css("margin:6px 0 0")}>Connect to Flare</h4>
                  <p style={css("font-size:13.5px;color:var(--color-neutral-400);margin:0")}>Subscriptions, staking and pay-per-alert settle on the Flare Network. Connect a wallet to manage billing.</p>
                  <button onClick={doConnect} className="btn btn-primary btn-block" style={css("max-width:220px")}>Connect Wallet</button>
                </div>
              ) : (
                <div>
                  <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px")}>
                    <div className="card elev-sm" style={css("gap:2px")}><div style={css("font-size:11px;color:var(--color-neutral-500)")}>Wallet</div><div style={css("font-size:16px;font-family:var(--font-heading)")}>{wallet.addrShort}</div><div style={css("font-size:11px;color:var(--color-neutral-500)")}>{wallet.networkName}</div></div>
                    <div className="card elev-sm" style={css("gap:2px")}><div style={css("font-size:11px;color:var(--color-neutral-500)")}>FLR balance</div><div style={css("font-size:22px;font-family:var(--font-heading)")}>{flrBalance}</div><div style={css("font-size:11px;color:var(--color-neutral-500)")}>≈ {flrUsd} · FTSO</div></div>
                    <div className="card elev-sm" style={css("gap:2px")}><div style={css("font-size:11px;color:var(--color-neutral-500)")}>Current plan</div><div style={css("font-size:16px;font-family:var(--font-heading);color:var(--color-accent-300)")}>{TIER_LABEL[tier]}</div><div style={css("font-size:11px;color:var(--color-neutral-500)")}>renews Jul 12</div></div>
                    <div className="card elev-sm" style={css("gap:2px")}><div style={css("font-size:11px;color:var(--color-neutral-500)")}>Staked FLR</div><div style={css("font-size:22px;font-family:var(--font-heading)")}>{staked}</div><div style={css("font-size:11px;color:var(--color-neutral-500)")}>unlocks Alpha tier</div></div>
                  </div>

                  <div className="card-kicker" style={css("margin-bottom:10px")}>Subscription tiers · settled on Flare</div>
                  <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px")}>
                    <div style={css(tierCard("scout"))}>
                      <div style={css("font-family:var(--font-heading);font-size:18px")}>Scout</div>
                      <div style={css("font-size:24px;font-family:var(--font-heading)")}>Free</div>
                      <div style={css("font-size:12px;color:var(--color-neutral-500);flex:1")}>DEX feed · 15-min delay · 3 alert rules · in-app only</div>
                      <button onClick={() => setTier("scout")} style={css(tierBtn("scout"))}>{tierLbl("scout")}</button>
                    </div>
                    <div style={css(tierCard("pro"))}>
                      <div style={css("position:absolute;top:-9px;left:16px")} className="tag tag-accent">Most picked</div>
                      <div style={css("font-family:var(--font-heading);font-size:18px")}>Pro</div>
                      <div style={css("font-size:24px;font-family:var(--font-heading)")}>15 <span style={css("font-size:13px;color:var(--color-neutral-500)")}>FLR / mo</span></div>
                      <div style={css("font-size:12px;color:var(--color-neutral-500);flex:1")}>Real-time CEX + DEX · Telegram · unlimited rules · full safety report</div>
                      <button onClick={subscribe("pro", 15)} style={css(tierBtn("pro"))}>{tierLbl("pro")}</button>
                    </div>
                    <div style={css(tierCard("alpha"))}>
                      <div style={css("font-family:var(--font-heading);font-size:18px")}>Alpha</div>
                      <div style={css("font-size:24px;font-family:var(--font-heading)")}>50 <span style={css("font-size:13px;color:var(--color-neutral-500)")}>FLR / mo</span></div>
                      <div style={css("font-size:12px;color:var(--color-neutral-500);flex:1")}>Sub-block alerts · webhook/API · mempool pre-alerts · or stake 500 FLR</div>
                      <button onClick={subscribe("alpha", 50)} style={css(tierBtn("alpha"))}>{tierLbl("alpha")}</button>
                    </div>
                  </div>

                  <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start")}>
                    <div className="card elev-sm" style={css("padding:18px;gap:10px")}>
                      <div className="card-kicker">Stake to unlock Alpha</div>
                      <p style={css("font-size:12.5px;color:var(--color-neutral-400);margin:0")}>Lock 500 FLR instead of paying monthly. Unstake anytime after 14 days.</p>
                      <button onClick={() => needWallet(() => setDialog({ title: "Stake FLR", label: "Stake amount", amount: "500 FLR", gas: "0.0026", total: "500.0026 FLR", toast: "Staked 500 FLR · Alpha unlocked", onOk: () => { setStaked("500"); setTier("alpha"); }, tx: { valueFlr: 0, data: memoHex("flavest:stake:500") }, histType: "Stake", histDetail: "Stake 500 FLR · Alpha unlock" }))} className="btn btn-secondary btn-block">Stake 500 FLR · charges gas</button>
                    </div>
                    <div className="card elev-sm" style={css("padding:18px;gap:8px")}>
                      <div className="card-kicker">One-time workspace access</div>
                      <p style={css("font-size:12.5px;color:var(--color-neutral-400);margin:0")}>Team seat with lifetime feed access, billed once on-chain.</p>
                      <button onClick={() => needWallet(() => setDialog({ title: "Buy workspace seat", label: "One-time access", amount: "120 FLR", gas: "0.0022", total: "120.0022 FLR", toast: "Seat purchased", tx: { valueFlr: 0, data: memoHex("flavest:seat:120") }, histType: "Seat", histDetail: "Workspace access · one-time" }))} className="btn btn-secondary btn-block">Buy seat · 120 FLR</button>
                    </div>
                  </div>

                  <div style={css("display:flex;align-items:center;justify-content:space-between;margin:22px 0 8px")}>
                    <div className="card-kicker">On-chain activity</div>
                    {history.length > 0 && (
                      <button onClick={() => setHistory([])} className="btn btn-ghost" style={css("font-size:11px")}>Clear</button>
                    )}
                  </div>
                  <div style={css("border-radius:12px;background:var(--color-surface);box-shadow:var(--shadow-sm);overflow:hidden")}>
                    <table className="table">
                      <thead><tr><th style={css("padding-left:18px")}>Type</th><th>Detail</th><th style={css("text-align:right")}>Amount</th><th>Gas</th><th style={css("text-align:right;padding-right:18px")}>Tx</th></tr></thead>
                      <tbody>
                        {history.map((x, i) => (
                          <tr key={x.hash + i}><td style={css("padding-left:18px")}><span className="tag tag-neutral">{x.type}</span></td><td style={css("font-size:13px;color:var(--color-neutral-300)")}>{x.detail}</td><td style={css("text-align:right;font-family:var(--font-heading)")}>{x.amount}</td><td style={css("font-size:12px;color:var(--color-neutral-500)")}>{x.gas}</td><td style={css("text-align:right;padding-right:18px;font-family:var(--font-heading);color:var(--color-accent-300);font-size:12.5px")}>{x.href ? <a href={x.href} target="_blank" rel="noopener noreferrer" style={css("color:var(--color-accent-300)")}>{x.hash}</a> : x.hash}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ SWAP & TRANSFER ═══ */}
          {view === "swap" && (
            <div style={css("animation:flvslide .3s ease;display:grid;grid-template-columns:minmax(0,440px) 1fr;gap:20px;align-items:start;max-width:940px")}>
              <div className="card elev-sm" style={css("padding:20px;gap:16px")}>
                <div className="seg" style={css("width:100%")}>
                  <label className="seg-opt" style={css("flex:1;justify-content:center")}><input type="radio" name="smode" checked={sMode === "convert"} onChange={() => setSMode("convert")} />Convert</label>
                  <label className="seg-opt" style={css("flex:1;justify-content:center")}><input type="radio" name="smode" checked={sMode === "buy"} onChange={() => setSMode("buy")} />Buy</label>
                  <label className="seg-opt" style={css("flex:1;justify-content:center")}><input type="radio" name="smode" checked={sMode === "transfer"} onChange={() => setSMode("transfer")} />Transfer</label>
                </div>

                <div style={css("background:color-mix(in srgb,var(--color-text) 3%,transparent);border-radius:11px;padding:13px")}>
                  <div style={css("display:flex;justify-content:space-between;font-size:11.5px;color:var(--color-neutral-500);margin-bottom:7px")}><span>{sMode === "buy" ? "You pay" : sMode === "transfer" ? "You send" : "From"}</span><span>Balance: {fromBal}</span></div>
                  <div style={css("display:flex;align-items:center;gap:10px")}>
                    <input className="input" type="number" value={sAmount} onChange={(e) => setSAmount(e.target.value)} style={css("border:0;background:transparent;font-size:24px;font-family:var(--font-heading);padding:0;min-height:auto")} />
                    <select className="input" value={sFrom} onChange={(e) => setSFrom(e.target.value)} style={css("width:auto;font-family:var(--font-heading)")}>
                      {payOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div style={css("display:flex;justify-content:center;margin:-8px 0")}><span style={css("width:32px;height:32px;border-radius:9px;background:var(--color-surface);box-shadow:var(--shadow-sm);display:grid;place-items:center;color:var(--color-accent-300)")}><Ic s={16} d={P.swapArrows} /></span></div>

                {sMode !== "transfer" ? (
                  <div style={css("background:color-mix(in srgb,var(--color-text) 3%,transparent);border-radius:11px;padding:13px")}>
                    <div style={css("display:flex;justify-content:space-between;font-size:11.5px;color:var(--color-neutral-500);margin-bottom:7px")}><span>You receive (est.)</span><span>FTSOv2 rate</span></div>
                    <div style={css("display:flex;align-items:center;gap:10px")}>
                      <div style={css("flex:1;font-size:24px;font-family:var(--font-heading)")}>{recvFmt}</div>
                      <select className="input" value={sTo} onChange={(e) => setSTo(e.target.value)} style={css("width:auto;font-family:var(--font-heading)")}>
                        {tokOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="field">
                      <label>Recipient wallet</label>
                      <input className="input" value={sRecipient} onChange={(e) => setSRecipient(e.target.value)} placeholder="0x… Flare address" />
                    </div>
                    <div style={css("font-size:11.5px;color:var(--color-neutral-500);display:flex;align-items:center;gap:6px")}><Ic s={13} d={P.info} />Double-check the address — transfers on Flare are irreversible.</div>
                  </>
                )}

                <div style={css("display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--color-neutral-400);border-top:1px solid var(--color-divider);padding-top:12px")}>
                  <div style={css("display:flex;justify-content:space-between")}><span>Rate</span><span style={css("color:var(--color-text)")}>{rateVal}</span></div>
                  <div style={css("display:flex;justify-content:space-between")}><span>Network fee (gas)</span><span style={css("color:var(--color-text)")}>{sMode === "transfer" ? "0.0009" : "0.0031"} FLR</span></div>
                  <div style={css("display:flex;justify-content:space-between")}><span>Route</span><span style={css("color:var(--color-text)")}>{sMode === "transfer" ? "Direct transfer" : "Flavest Router · SparkDEX"}</span></div>
                </div>

                <button onClick={execSwap} className="btn btn-primary btn-block" style={css("margin-top:0")}>{sMode === "buy" ? "Buy " + tSym(sTo) + " · charges gas" : sMode === "transfer" ? "Send · charges gas" : "Swap now · charges gas"}</button>
              </div>

              <div style={css("display:flex;flex-direction:column;gap:16px")}>
                <div className="card elev-sm" style={css("padding:18px;gap:9px")}>
                  <div className="card-kicker">How it settles on Flare</div>
                  <div style={css("font-size:12.5px;color:var(--color-neutral-300);line-height:1.6")}>{swapExplain[sMode]}</div>
                </div>
                <div className="card elev-sm" style={css("padding:18px;gap:10px")}>
                  <div className="card-kicker">Your balances</div>
                  <div style={css("display:flex;justify-content:space-between;font-size:13px")}><span style={css("color:var(--color-neutral-400)")}>FLR</span><span style={css("font-family:var(--font-heading)")}>{flrBalance}</span></div>
                  <div style={css("display:flex;justify-content:space-between;font-size:13px")}><span style={css("color:var(--color-neutral-400)")}>USD₮ (bridged)</span><span style={css("font-family:var(--font-heading)")}>318.40</span></div>
                  <div style={css("display:flex;justify-content:space-between;font-size:13px")}><span style={css("color:var(--color-neutral-400)")}>$NOVA</span><span style={css("font-family:var(--font-heading)")}>0.00</span></div>
                  <div style={css("font-size:11px;color:var(--color-neutral-600);border-top:1px solid var(--color-divider);padding-top:8px")}>Prices reference the FTSOv2 block-latency feed. Settlement is a single signed transaction; gas is paid in FLR.</div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ MOBILE ═══ */}
          {view === "mobile" && (
            <div style={css("animation:flvslide .3s ease;display:flex;gap:34px;flex-wrap:wrap;justify-content:center;padding-top:8px")}>
              {/* phone 1: feed */}
              <div style={css("width:300px;height:620px;border-radius:38px;background:#0f111c;padding:11px;box-shadow:var(--shadow-lg),0 0 60px rgba(145,132,217,.15);flex:none")}>
                <div style={css("width:100%;height:100%;border-radius:29px;background:var(--color-bg);overflow:hidden;position:relative;display:flex;flex-direction:column")}>
                  <div style={css("position:absolute;top:9px;left:50%;transform:translateX(-50%);width:92px;height:22px;background:#0f111c;border-radius:14px;z-index:2")} />
                  <div style={css("padding:20px 16px 12px;display:flex;align-items:center;gap:8px")}>
                    <div style={css("width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,var(--color-accent),#5d5294);display:grid;place-items:center")}><Ic s={12} d={P.lightning} fill="#161826" /></div>
                    <b style={css("font-size:15px;font-family:var(--font-heading)")}>Live Feed</b>
                    <span style={css("margin-left:auto;width:7px;height:7px;border-radius:50%;background:#4ea89a;animation:flvpulse 1.4s infinite")} />
                  </div>
                  <div style={css("flex:1;overflow:hidden;padding:0 12px;display:flex;flex-direction:column;gap:8px")}>
                    {mobileFeed.map((m) => (
                      <div key={m.id} style={css("background:var(--color-surface);border-radius:11px;padding:11px;box-shadow:var(--shadow-sm)")}>
                        <div style={css("display:flex;align-items:center;gap:9px")}>
                          <div style={css(`width:28px;height:28px;border-radius:8px;background:${m.iconBg};display:grid;place-items:center;font-size:11px;color:#f3f5fe;font-family:var(--font-heading)`)}>{m.mono}</div>
                          <div style={css("flex:1;line-height:1.2")}><div style={css("font-size:13px;font-family:var(--font-heading)")}>{m.sym}</div><div style={css("font-size:10.5px;color:var(--color-neutral-500)")}>{m.venue} · {m.age}</div></div>
                          <div style={css("text-align:right")}><div style={css(`font-size:13px;font-family:var(--font-heading);color:${m.riskColor}`)}>{m.safety}</div><div style={css("font-size:9px;color:var(--color-neutral-500)")}>safety</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={css("display:flex;justify-content:space-around;padding:12px 0 18px;border-top:1px solid var(--color-divider)")}>
                    <span style={css("color:var(--color-accent)")}><Ic s={20} d="M216 40H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16Z" /></span>
                    <span style={css("color:var(--color-neutral-600)")}><Ic s={20} d={P.bellSolid} /></span>
                    <span style={css("color:var(--color-neutral-600)")}><Ic s={20} d={P.wallet} /></span>
                  </div>
                </div>
              </div>

              {/* phone 2: push alert */}
              <div style={css("width:300px;height:620px;border-radius:38px;background:#0f111c;padding:11px;box-shadow:var(--shadow-lg),0 0 60px rgba(230,34,74,.12);flex:none")}>
                <div style={css("width:100%;height:100%;border-radius:29px;background:linear-gradient(180deg,#1b1d2e,#141622);overflow:hidden;position:relative;display:flex;flex-direction:column;align-items:center;padding-top:56px")}>
                  <div style={css("position:absolute;top:9px;left:50%;transform:translateX(-50%);width:92px;height:22px;background:#0f111c;border-radius:14px;z-index:2")} />
                  <div style={css("font-size:52px;font-family:var(--font-heading);font-weight:600")}>9:41</div>
                  <div style={css("font-size:12px;color:var(--color-neutral-400);margin-bottom:24px")}>Thursday, June 12</div>
                  <div style={css("width:86%;background:rgba(35,37,50,.92);backdrop-filter:blur(8px);border-radius:16px;padding:13px;box-shadow:var(--shadow-md);animation:flvslide .5s ease")}>
                    <div style={css("display:flex;align-items:center;gap:8px;margin-bottom:8px")}>
                      <div style={css("width:20px;height:20px;border-radius:5px;background:linear-gradient(135deg,var(--color-accent),#5d5294);display:grid;place-items:center")}><Ic s={11} d={P.lightning} fill="#161826" /></div>
                      <b style={css("font-size:12px;font-family:var(--font-heading)")}>Flavest</b>
                      <span style={css("margin-left:auto;font-size:10px;color:var(--color-neutral-500)")}>now</span>
                    </div>
                    <div style={css("font-size:13.5px;font-family:var(--font-heading);margin-bottom:3px")}>New pair · $NOVA on SparkDEX</div>
                    <div style={css("font-size:12px;color:var(--color-neutral-300);line-height:1.45")}>Safety 82 · LP locked 90d · ownership renounced · $142k liquidity. Detected 312ms after pool creation.</div>
                    <div style={css("display:flex;gap:6px;margin-top:9px")}><span className="tag tag-accent" style={css("font-size:10px")}>Verified on Flare</span><span className="tag tag-neutral" style={css("font-size:10px")}>Safe</span></div>
                  </div>
                  <div style={css("width:86%;background:rgba(35,37,50,.72);border-radius:14px;padding:11px;margin-top:10px")}>
                    <div style={css("display:flex;align-items:center;gap:8px")}><div style={css("width:18px;height:18px;border-radius:5px;background:#2AABEE;display:grid;place-items:center")}><svg width="11" height="11" viewBox="0 0 240 240" fill="#fff" aria-hidden><path d="M181 71 158 187c-2 8-6 10-13 6l-35-26-17 16 3-36 65-59-80 50-35-11c-8-2-8-8 2-11l137-53c6-2 12 2 8 12Z" /></svg></div><b style={css("font-size:11px")}>Telegram</b><span style={css("margin-left:auto;font-size:10px;color:var(--color-neutral-500)")}>now</span></div>
                    <div style={css("font-size:11.5px;color:var(--color-neutral-300);margin-top:5px")}>⚡ $NOVA alert delivered · receipt 0x8f…c1a2</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ══ GAS DIALOG ══ */}
      {dialog && (
        <div className="dialog-backdrop" onClick={() => { if (!sending) setDialog(null); }}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} style={css("animation:flvslide .2s ease")}>
            <div style={css("display:flex;align-items:center;gap:10px")}>
              <div style={css("width:34px;height:34px;border-radius:9px;background:conic-gradient(from 140deg,#9184d9,#e6224a,#9184d9);flex:none")} />
              <div><div className="dialog-title" style={css("font-size:18px")}>{dialog.title}</div><div style={css("font-size:12px;color:var(--color-neutral-500)")}>{wallet.networkName}</div></div>
            </div>
            <div className="dialog-body" style={css("display:flex;flex-direction:column;gap:9px;margin-top:4px")}>
              <div style={css("display:flex;justify-content:space-between;font-size:14px")}><span style={css("color:var(--color-neutral-400)")}>{dialog.label}</span><span style={css("font-family:var(--font-heading)")}>{dialog.amount}</span></div>
              <div style={css("display:flex;justify-content:space-between;font-size:14px")}><span style={css("color:var(--color-neutral-400)")}>Network fee (gas)</span><span style={css("font-family:var(--font-heading)")}>{dialog.gas} FLR</span></div>
              <div style={css("height:1px;background:var(--color-divider);margin:2px 0")} />
              <div style={css("display:flex;justify-content:space-between;font-size:14px")}><span>Total</span><span style={css("font-family:var(--font-heading);color:var(--color-accent-300)")}>{dialog.total}</span></div>
              <div style={css("font-size:11px;color:var(--color-neutral-600);display:flex;align-items:center;gap:6px;margin-top:2px")}>
                <span style={css(`width:6px;height:6px;border-radius:50%;background:${dialog.tx && wallet.conn && !wallet.isDemo ? "#4ea89a" : "var(--color-neutral-500)"}`)} />
                {dialog.tx && wallet.conn && !wallet.isDemo
                  ? "Signs a real transaction on " + wallet.networkName + " — gas is paid from your wallet."
                  : "Demo wallet — this signature is simulated (connect a wallet for a real tx)."}
              </div>
            </div>
            <div className="dialog-actions">
              <button onClick={() => setDialog(null)} className="btn btn-secondary" disabled={sending}>Reject</button>
              <button onClick={confirmDialog} className="btn btn-primary" disabled={sending}>{sending ? "Waiting for wallet…" : "Confirm & sign"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TOAST ══ */}
      {toast && (
        <div style={css("position:fixed;bottom:22px;right:22px;background:var(--color-surface);box-shadow:var(--shadow-lg);border-radius:11px;padding:13px 15px;display:flex;align-items:center;gap:11px;max-width:340px;animation:flvslide .3s ease;z-index:50")}>
          <span style={css("width:26px;height:26px;border-radius:50%;background:rgba(78,168,154,.16);display:grid;place-items:center;flex:none;color:#4ea89a")}><Ic s={16} d={P.toastCheck} /></span>
          <div style={css("line-height:1.3")}><div style={css("font-size:13px;font-family:var(--font-heading)")}>{toast.title}</div>
            {toast.href ? (
              <a href={toast.href} target="_blank" rel="noopener noreferrer" style={css("font-size:11.5px;color:var(--color-accent-300)")}>{toast.msg}</a>
            ) : (
              <div style={css("font-size:11.5px;color:var(--color-neutral-500)")}>{toast.msg}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
