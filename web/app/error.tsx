"use client";

import { EmptyState } from "@/app/_components/EmptyState";
import { errorMessage } from "@/app/_components/errorMessage";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="fridge-screen">
      <EmptyState message={errorMessage(error)} />
      <button className="outline-button" onClick={retry}>
        try again
      </button>
    </main>
  );
}
