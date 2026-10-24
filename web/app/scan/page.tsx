"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { ScanFlow } from "@/app/_components/ScanFlow";

function Scan() {
  const router = useRouter();
  // The receipt id lives in the URL so a reload resumes instead of paying for a second parse; Convex validates it.
  const receiptId = useSearchParams().get("receipt") as Id<"receipts"> | null;
  return (
    <ScanFlow
      receiptId={receiptId}
      onReceipt={(id) => router.replace(id ? `/scan?receipt=${id}` : "/scan")}
      onDone={() => router.push("/fridge")}
    />
  );
}

export default function ScanPage() {
  return (
    <Suspense>
      <Scan />
    </Suspense>
  );
}
