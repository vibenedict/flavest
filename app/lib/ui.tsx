import type { CSSProperties } from "react";

/**
 * Convert a plain CSS declaration string ("display:flex;gap:10px") into a
 * React style object. Lets us port the Nocturne/Flavest design comp's inline
 * styles almost verbatim. Custom properties (--x) are passed through as-is.
 */
export function css(decl: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const part of decl.split(";")) {
    const seg = part.trim();
    if (!seg) continue;
    const idx = seg.indexOf(":");
    if (idx === -1) continue;
    const rawKey = seg.slice(0, idx).trim();
    const value = seg.slice(idx + 1).trim();
    if (!rawKey) continue;
    const key = rawKey.startsWith("--")
      ? rawKey
      : rawKey.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = value;
  }
  return out as CSSProperties;
}

/** Single-path Phosphor-style icon. */
export function Ic({
  d,
  s = 16,
  fill = "currentColor",
  viewBox = "0 0 256 256",
}: {
  d: string;
  s?: number;
  fill?: string;
  viewBox?: string;
}) {
  return (
    <svg width={s} height={s} viewBox={viewBox} fill={fill} aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Frequently used Phosphor glyph paths (from the design comp). */
export const P = {
  lightning:
    "M215.79 118.17 178.6 116l16.57-56.24a8 8 0 0 0-13.11-8L47.36 130.79A8 8 0 0 0 52 145.79l37.19 2.19-16.57 56.24a8 8 0 0 0 13.11 8L219.63 133.17a8 8 0 0 0-3.84-15z",
  feed: "M216 40H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16Zm0 160H40V88h176v112Z",
  feedRows: "M72 132h32v32H72zm56-16h56v16h-56zm0 32h56v16h-56z",
  bell: "M221.8 175.94C216.25 166.38 208 139.33 208 104a80 80 0 1 0-160 0c0 35.34-8.26 62.38-13.81 71.94A16 16 0 0 0 48 200h40.81a40 40 0 0 0 78.38 0H208a16 16 0 0 0 13.8-24.06ZM128 216a24 24 0 0 1-22.62-16h45.24A24 24 0 0 1 128 216Z",
  bellSolid:
    "M221.8 175.94C216.25 166.38 208 139.33 208 104a80 80 0 1 0-160 0c0 35.34-8.26 62.38-13.81 71.94A16 16 0 0 0 48 200h160a16 16 0 0 0 13.8-24.06Z",
  wallet:
    "M216 64H56a8 8 0 0 1 0-16h144a8 8 0 0 0 0-16H56a24 24 0 0 0-24 24v144a24 24 0 0 0 24 24h160a16 16 0 0 0 16-16V80a16 16 0 0 0-16-16Zm-36 92a16 16 0 1 1 16-16 16 16 0 0 1-16 16Z",
  swap: "M104 64a8 8 0 0 1-8 8H51.31l18.35 18.34a8 8 0 0 1-11.32 11.32l-32-32a8 8 0 0 1 0-11.32l32-32a8 8 0 0 1 11.32 11.32L51.31 56H96a8 8 0 0 1 8 8Zm93.66 96.34a8 8 0 0 0-11.32 11.32L204.69 190H160a8 8 0 0 0 0 16h44.69l-18.35 18.34a8 8 0 0 0 11.32 11.32l32-32a8 8 0 0 0 0-11.32ZM48 120h160a8 8 0 0 0 0-16H48a8 8 0 0 0 0 16Z",
  phone:
    "M176 16H80a24 24 0 0 0-24 24v176a24 24 0 0 0 24 24h96a24 24 0 0 0 24-24V40a24 24 0 0 0-24-24Zm-40 200a12 12 0 1 1 12-12 12 12 0 0 1-12 12Z",
  caretRight:
    "M181.66 133.66l-80 80a8 8 0 0 1-11.32-11.32L164.69 128 90.34 53.66a8 8 0 0 1 11.32-11.32l80 80a8 8 0 0 1 0 11.32Z",
  info: "M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm12 120a12 12 0 1 1-12-12 12 12 0 0 1 12 12Zm-12-28a8 8 0 0 1-8-8V88a8 8 0 0 1 16 0v20a8 8 0 0 1-8 8Z",
  arrowLeft:
    "M165.66 202.34a8 8 0 0 1-11.32 11.32l-80-80a8 8 0 0 1 0-11.32l80-80a8 8 0 0 1 11.32 11.32L91.31 128Z",
  check:
    "M181.66 90.34a8 8 0 0 1 0 11.32L110.63 172.7a8 8 0 0 1-11.32 0l-40-40a8 8 0 0 1 11.32-11.32L105 155.31l65.34-65.34a8 8 0 0 1 11.32 0Z",
  eye: "M247.31 124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57 61.26 162.88 48 128 48S61.43 61.26 36.34 86.35C17.51 105.18 9 124 8.69 124.76a8 8 0 0 0 0 6.5c.35.79 8.82 19.57 27.65 38.4C61.43 194.74 93.12 208 128 208s66.57-13.26 91.66-38.34c18.83-18.83 27.3-37.61 27.65-38.4a8 8 0 0 0 0-6.5ZM128 168a40 40 0 1 1 40-40 40 40 0 0 1-40 40Z",
  swapArrows:
    "M213.66 181.66l-32 32a8 8 0 0 1-11.32-11.32L188.69 184H48a8 8 0 0 1 0-16h140.69l-18.35-18.34a8 8 0 0 1 11.32-11.32l32 32a8 8 0 0 1 0 11.32Zm-139.32-64a8 8 0 0 0 11.32-11.32L67.31 88H208a8 8 0 0 0 0-16H67.31l18.35-18.34a8 8 0 0 0-11.32-11.32l-32 32a8 8 0 0 0 0 11.32Z",
  toastCheck:
    "M229.66 77.66l-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z",
};
