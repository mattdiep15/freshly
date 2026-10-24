"use client";

import { useRouter } from "next/navigation";
import { demoParsedReceipt } from "@/app/_demo/fixtures";
import { ScanFlow } from "@/components/ScanFlow";

export default function ScanPage() {
  const router = useRouter();
  // TODO(release): upload to Convex storage and read parsed lines from the p1-02 receipt query.
  return <ScanFlow parsedLines={demoParsedReceipt} onDone={() => router.push("/fridge")} />;
}
