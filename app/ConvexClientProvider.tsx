"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
// Fail with the fix instead of Convex's "No address provided" during build.
if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set. See Running locally in docs/exec-plans/p1-01-backend-foundation.md.");
const convex = new ConvexReactClient(url);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
