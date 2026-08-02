import { NextResponse } from "next/server";
import { TOKENS } from "../../lib/data";

// Public safety-verdict JSON for a token. Flare's FDC Web2Json verifier fetches
// this URL, jq-transforms it into the DataTransportObject, and attests it — the
// verdict FlavestAttestationRegistry then verifies + stores on-chain.
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("token") || "").toLowerCase().replace(/^\$/, "");
  const t = TOKENS.find(
    (x) => x.id === q || x.sym.toLowerCase() === q || x.sym.toLowerCase() === "$" + q,
  );
  if (!t) return NextResponse.json({ error: "unknown token" }, { status: 404 });
  return NextResponse.json({
    symbol: t.sym,
    venue: t.venue,
    safety: t.safety,
    honeypot: t.honeypot,
    lpLocked: t.lpLocked,
    renounced: t.renounced,
  });
}
