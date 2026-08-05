import { useId, type CSSProperties } from "react";

/**
 * Flavest brand logo — the finalized "charged wordmark" from the Flavest Logo
 * design handoff. Space Grotesk 600; "Fl"/"vest" in the neutral ink, the "a"
 * carrying the signal gradient (#ff4d8d → #ff9a3d), and a market tick-line
 * dipping beneath "vest". Geometry matches assets/flavest-wordmark.svg exactly.
 */

export type LogoVariant = "dark" | "light" | "reversed" | "mono";

const TICK = "M150 150 L214 150 L250 159 L318 137 L392 151 L466 145 L616 145";

export function FlavestWordmark({
  variant = "dark",
  width = 180,
  style,
  title = "Flavest",
}: {
  variant?: LogoVariant;
  width?: number;
  style?: CSSProperties;
  title?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const gid = `flvGrad-${uid}`;

  const palette: Record<LogoVariant, { text: string; a: string; tick: string }> = {
    dark: { text: "#e9e9ed", a: `url(#${gid})`, tick: "#ff4d8d" },
    light: { text: "#1a1c2e", a: `url(#${gid})`, tick: "#ff4d8d" },
    reversed: { text: "#1a0f16", a: "#1a0f16", tick: "#1a0f16" },
    mono: { text: "currentColor", a: "currentColor", tick: "currentColor" },
  };
  const p = palette[variant];

  return (
    <svg
      width={width}
      height={(width * 172) / 640}
      viewBox="0 0 640 172"
      role="img"
      aria-label={title}
      style={{
        display: "block",
        maxWidth: "100%",
        filter: variant === "dark" ? "drop-shadow(0 8px 26px rgba(255,77,141,0.22))" : "none",
        ...style,
      }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff4d8d" />
          <stop offset="1" stopColor="#ff9a3d" />
        </linearGradient>
      </defs>
      <text
        x="24"
        y="120"
        fontSize="104"
        letterSpacing="-4"
        fontFamily="'Space Grotesk', var(--font-heading), system-ui, sans-serif"
        fontWeight={600}
      >
        <tspan fill={p.text}>Fl</tspan>
        <tspan fill={p.a}>a</tspan>
        <tspan fill={p.text}>vest</tspan>
      </text>
      <path
        d={TICK}
        fill="none"
        stroke={p.tick}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />
    </svg>
  );
}

/**
 * App-icon / favicon glyph — a rounded tile in the signal gradient with a
 * capital "F" (Space Grotesk 700) and a small tick beneath, derived from the
 * wordmark. Matches the handoff app-icon spec.
 */
export function FlavestIcon({ size = 32, style }: { size?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        background: "linear-gradient(135deg,#ff4d8d,#ff9a3d)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 ${size * 0.11}px ${size * 0.36}px rgba(255,77,141,0.4)`,
        flex: "none",
        ...style,
      }}
    >
      <svg width={size * 0.68} height={size * 0.68} viewBox="0 0 40 40" aria-hidden>
        <text
          x="7"
          y="30"
          fontFamily="'Space Grotesk', system-ui, sans-serif"
          fontSize="32"
          fontWeight="700"
          fill="#1a0f16"
        >
          F
        </text>
        <path
          d="M6 33 L14 33 L18 29 L26 33 L34 31"
          fill="none"
          stroke="#1a0f16"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}
