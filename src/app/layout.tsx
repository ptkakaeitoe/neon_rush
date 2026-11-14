import type { Metadata, Viewport } from "next";
// Self-hosted fonts (works offline for classroom demos)
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource/silkscreen/400.css";
import "@fontsource/silkscreen/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neon Rush Arena",
  description:
    "Four arcade games against four AI opponents: Minimax, Alpha-Beta Pruning, A* Search and a Markov predictor.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
