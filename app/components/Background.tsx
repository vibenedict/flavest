import { css } from "../lib/ui";

/** Animated colour-wash + floating token coins behind the whole workspace. */
export default function Background() {
  const coin = (
    outer: string,
    inner: string,
    content: React.ReactNode,
  ) => (
    <div style={css(outer)}>
      <div style={css(inner)}>{content}</div>
    </div>
  );

  const lightningWhite = (
    <svg width="30" height="30" viewBox="0 0 256 256" fill="#fff" aria-hidden>
      <path d="M215.79 118.17 178.6 116l16.57-56.24a8 8 0 0 0-13.11-8L47.36 130.79A8 8 0 0 0 52 145.79l37.19 2.19-16.57 56.24a8 8 0 0 0 13.11 8L219.63 133.17a8 8 0 0 0-3.84-15z" />
    </svg>
  );
  const lightningDark = (
    <svg width="20" height="20" viewBox="0 0 256 256" fill="#241a4d" aria-hidden>
      <path d="M215.79 118.17 178.6 116l16.57-56.24a8 8 0 0 0-13.11-8L47.36 130.79A8 8 0 0 0 52 145.79l37.19 2.19-16.57 56.24a8 8 0 0 0 13.11 8L219.63 133.17a8 8 0 0 0-3.84-15z" />
    </svg>
  );

  return (
    <div aria-hidden style={css("position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0")}>
      {/* colour wash blobs */}
      <div style={css("position:absolute;top:-14%;left:4%;width:46vw;height:46vw;border-radius:50%;background:radial-gradient(circle at 40% 40%,#a78bfa,transparent 66%);opacity:.55;filter:blur(66px);animation:flvblob1 26s ease-in-out infinite")} />
      <div style={css("position:absolute;bottom:-20%;right:-6%;width:52vw;height:52vw;border-radius:50%;background:radial-gradient(circle at 50% 50%,#ff4d6d,transparent 64%);opacity:.4;filter:blur(76px);animation:flvblob2 32s ease-in-out infinite")} />
      <div style={css("position:absolute;top:16%;right:20%;width:40vw;height:40vw;border-radius:50%;background:radial-gradient(circle at 50% 50%,#38bdf8,transparent 66%);opacity:.4;filter:blur(70px);animation:flvblob3 29s ease-in-out infinite")} />
      <div style={css("position:absolute;bottom:6%;left:22%;width:36vw;height:36vw;border-radius:50%;background:radial-gradient(circle at 50% 50%,#34d399,transparent 68%);opacity:.32;filter:blur(72px);animation:flvblob1 34s ease-in-out infinite reverse")} />

      {/* floating token coins */}
      {coin(
        "position:absolute;top:12%;left:34%;opacity:.62;animation:flvcoinA 15s ease-in-out infinite",
        "width:58px;height:58px;border-radius:50%;display:grid;place-items:center;font-family:var(--font-heading);font-weight:600;color:#fff;font-size:26px;background:linear-gradient(140deg,#F7931A,#c56e07);box-shadow:0 10px 30px rgba(247,147,26,.5),inset 0 2px 7px rgba(255,255,255,.4);animation:flvspin 9s linear infinite",
        "₿",
      )}
      {coin(
        "position:absolute;top:62%;left:40%;opacity:.55;animation:flvcoinB 19s ease-in-out infinite",
        "width:50px;height:50px;border-radius:50%;display:grid;place-items:center;font-family:var(--font-heading);font-weight:600;color:#fff;font-size:24px;background:linear-gradient(140deg,#7b8df5,#4759c9);box-shadow:0 10px 30px rgba(98,126,234,.5),inset 0 2px 7px rgba(255,255,255,.4);animation:flvspin 11s linear infinite",
        "Ξ",
      )}
      {coin(
        "position:absolute;top:30%;left:66%;opacity:.6;animation:flvcoinC 17s ease-in-out infinite",
        "width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(140deg,#ff4d6d,#c31740);box-shadow:0 10px 32px rgba(230,34,74,.55),inset 0 2px 7px rgba(255,255,255,.4);animation:flvspin 8s linear infinite",
        lightningWhite,
      )}
      {coin(
        "position:absolute;top:74%;left:70%;opacity:.5;animation:flvcoinA 21s ease-in-out infinite",
        "width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-family:var(--font-heading);font-weight:600;color:#0b3b28;font-size:21px;background:linear-gradient(140deg,#5ff5b4,#14c47a);box-shadow:0 10px 28px rgba(20,241,149,.5),inset 0 2px 7px rgba(255,255,255,.5);animation:flvspin 12s linear infinite",
        "◎",
      )}
      {coin(
        "position:absolute;top:8%;left:80%;opacity:.5;animation:flvcoinB 16s ease-in-out infinite",
        "width:48px;height:48px;border-radius:50%;display:grid;place-items:center;font-family:var(--font-heading);font-weight:600;color:#3a2f05;font-size:20px;background:linear-gradient(140deg,#ffd94a,#f0b90b);box-shadow:0 10px 28px rgba(240,185,11,.5),inset 0 2px 7px rgba(255,255,255,.5);animation:flvspin 10s linear infinite",
        "BNB",
      )}
      {coin(
        "position:absolute;top:48%;left:28%;opacity:.5;animation:flvcoinC 23s ease-in-out infinite",
        "width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-family:var(--font-heading);font-weight:600;color:#fff;font-size:18px;background:linear-gradient(140deg,#3fd39a,#1f8a63);box-shadow:0 10px 26px rgba(38,161,123,.5),inset 0 2px 6px rgba(255,255,255,.4);animation:flvspin 13s linear infinite",
        "₮",
      )}
      {coin(
        "position:absolute;top:84%;left:46%;opacity:.5;animation:flvcoinA 18s ease-in-out infinite",
        "width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(140deg,#c0b6ff,#8a7bf0);box-shadow:0 8px 24px rgba(145,132,217,.5),inset 0 2px 6px rgba(255,255,255,.45);animation:flvspin 14s linear infinite",
        lightningDark,
      )}
      {coin(
        "position:absolute;top:22%;left:50%;opacity:.42;animation:flvcoinB 25s ease-in-out infinite",
        "width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-family:var(--font-heading);font-weight:600;color:#fff;font-size:18px;background:linear-gradient(140deg,#7b8df5,#4759c9);box-shadow:0 8px 22px rgba(98,126,234,.45),inset 0 2px 6px rgba(255,255,255,.4);animation:flvspin 15s linear infinite",
        "Ξ",
      )}

      <div style={css("position:absolute;inset:0;background:radial-gradient(135% 105% at 50% 12%,transparent,color-mix(in srgb,var(--color-bg) 70%,transparent) 94%)")} />
    </div>
  );
}
