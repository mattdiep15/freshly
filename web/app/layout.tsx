import type { Metadata, Viewport } from "next";
import { DM_Sans, Sniglet } from "next/font/google";
import { SiteHeader } from "@/app/_components/SiteHeader";
import "./globals.css";
// Order matters: some rules must load after rules in an earlier file (see the "loads here" comments).
import "./_styles/fridge.css";
import "./_styles/friends.css";
import "./_styles/home.css";
import "./_styles/scan.css";
import "./_styles/shell.css";
import "./_styles/stats.css";
import "./_styles/swipe.css";
import "./_styles/design-v5.css";
import "./_styles/design-v6.css";
import "./_styles/design-v7.css";
import { ConvexClientProvider } from "./ConvexClientProvider";

const bodyFont = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Sniglet({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "freshly",
  description: "Know what's in your fridge and use it before it goes bad.",
};

// Cover lets env(safe-area-inset-*) in globals.css report the notch and home bar on iOS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        <ConvexClientProvider>
          <div className="app-shell">
            <SiteHeader />
            <div className="mobile-page-scroll">
              {children}
            </div>
            <footer>
              <p>spoil less eat fresh!</p>
              <span>freshly © 2026</span>
            </footer>
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
