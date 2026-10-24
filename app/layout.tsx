import type { Metadata } from "next";
import { DM_Sans, Sniglet } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        <ConvexClientProvider>
          <div className="app-shell">
            <SiteHeader />
            {children}
            <footer>
              <p>keep it fresh. keep it simple.</p>
              <span>freshly © 2026</span>
            </footer>
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
