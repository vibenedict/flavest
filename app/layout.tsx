import type { Metadata, Viewport } from "next";
import "./globals.css";

const DESCRIPTION =
  "Real-time CEX listing and DEX new-pair tracker with an anti-rug safety engine, verified on the Flare Network.";

export const metadata: Metadata = {
  metadataBase: new URL("https://flavest.vercel.app"),
  title: "Flavest · Launch Radar",
  description: DESCRIPTION,
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Flavest · Launch Radar",
    description: DESCRIPTION,
    url: "/",
    siteName: "Flavest",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Flavest · Launch Radar",
    description: DESCRIPTION,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0e16",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
