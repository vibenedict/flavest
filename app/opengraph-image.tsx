import { ImageResponse } from "next/og";

export const alt = "Flavest · Launch radar on Flare — safety-scored, FTSO-priced, FDC-verified";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Fetch a WOFF from the @fontsource CDN (Satori supports WOFF; WOFF2 it does not).
async function loadFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font fetch ${res.status}: ${url}`);
  return res.arrayBuffer();
}

export default async function OpengraphImage() {
  const [grotesk, inter] = await Promise.all([
    loadFont("https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk@5/files/space-grotesk-latin-600-normal.woff"),
    loadFont("https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-500-normal.woff"),
  ]);

  const chip = (label: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 22px",
        borderRadius: 999,
        border: "1px solid #2a2f49",
        background: "#141626",
        fontSize: 26,
        color: "#cfd3e5",
      }}
    >
      <div style={{ width: 12, height: 12, borderRadius: 999, background: "#ff4d8d" }} />
      {label}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(150deg, #14122a 0%, #0f1120 45%, #0d0e16 100%)",
          color: "#e9e9ed",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 24, letterSpacing: 6, textTransform: "uppercase", color: "#6d7290" }}>
            Launch Radar · Built on Flare
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontFamily: "Space Grotesk", fontSize: 176, letterSpacing: -6, lineHeight: 1 }}>
              <span style={{ color: "#e9e9ed" }}>Fl</span>
              <span
                style={{
                  backgroundImage: "linear-gradient(135deg, #ff4d8d, #ff9a3d)",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                a
              </span>
              <span style={{ color: "#e9e9ed" }}>vest</span>
            </div>
          </div>
          <div style={{ width: 470, height: 5, borderRadius: 3, background: "linear-gradient(90deg, #ff4d8d, #ff9a3d)" }} />
          <div style={{ fontSize: 38, color: "#a2a6bd", maxWidth: 900, lineHeight: 1.35 }}>
            Catch new token launches early — each safety-scored, FTSO-priced, and FDC-verified on Flare.
          </div>
        </div>

        <div style={{ display: "flex", gap: 18 }}>
          {chip("FTSOv2 live")}
          {chip("FDC-attested")}
          {chip("flavest.vercel.app")}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Space Grotesk", data: grotesk, weight: 600, style: "normal" },
        { name: "Inter", data: inter, weight: 500, style: "normal" },
      ],
    },
  );
}
