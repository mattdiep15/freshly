import type { Metadata, Viewport } from "next";
import { DM_Sans, Sniglet } from "next/font/google";
import { SiteHeader } from "@/app/_components/SiteHeader";
import "./globals.css";
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
              <div className="mobile-page-end-spacer" aria-hidden="true" />
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
