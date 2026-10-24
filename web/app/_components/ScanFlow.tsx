"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ItemView } from "@/convex/items";
import { dateInputValue, endOfLocalDay } from "@/lib/freshness";
import { CAMERA_FILE_EVENT } from "@/app/_components/cameraFile";
import { errorMessage } from "@/app/_components/errorMessage";
import { shrinkImage } from "@/app/_components/shrinkImage";
import { Leekly } from "@/app/_components/ui/Leekly";
import { SourceNote } from "@/app/_components/ui/SourceNote";

type Receipt = { file: File; previewUrl: string };

// Mirrors MAX_PDF_BYTES in convex/receiptsNode.ts.
const MAX_PDF_BYTES = 20 * 1024 * 1024;

function ManualAdd({ onDone }: { onDone: () => void }) {
  const addManual = useAction(api.receiptsNode.addManual);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="manual-add"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const name = String(form.get("name") ?? "").trim();
        const date = String(form.get("date") ?? "");
        if (!name) return;
        setAdding(true);
        setError(null);
        try {
          await addManual({ name, expiresAt: date ? endOfLocalDay(date) : undefined });
          onDone();
        } catch (e) {
          setError(errorMessage(e));
          setAdding(false);
        }
      }}
    >
      <p className="eyebrow">or type it instead</p>
      <div className="manual-fields">
        <label>
          food
          <input name="name" required placeholder="greek yogurt" autoComplete="off" />
        </label>
        <label>
          good until (optional)
          <input name="date" type="date" />
        </label>
        <button className="add-button" disabled={adding}>
          {adding ? "adding..." : "add"}
        </button>
      </div>
      {error && <p className="scan-error">{error}</p>}
    </form>
  );
}

function ReceiptOptions({ onPick, onDone }: { onPick: (file?: File) => void; onDone: () => void }) {
  return (
    <>
      <div className="receipt-options">
        <label className="receipt-choice">
          <input type="file" accept="image/*" capture="environment" onChange={(e) => onPick(e.target.files?.[0])} />
          <Leekly pose="photo" className="scan-mascot" />
          <span className="camera-choice-copy">
            <strong>take a photo</strong>
          </span>
        </label>
        <label className="receipt-choice upload-choice">
          <input type="file" accept="image/*,.pdf" onChange={(e) => onPick(e.target.files?.[0])} />
          <Leekly pose="file" className="file-leek" />
          <span className="file-choice-copy">
            <svg className="upload-file-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 2h9l5 5v15H5zM14 2v5h5" />
            </svg>
            <strong>upload from files</strong>
          </span>
        </label>
      </div>
      <ManualAdd onDone={onDone} />
    </>
  );
}

function ReceiptPreview({ receipt, error, onRetake, onContinue }: {
  receipt: Receipt;
  error: string | null;
  onRetake: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="receipt-preview">
      {receipt.file.type === "application/pdf" ? (
        <p className="receipt-file">{receipt.file.name}</p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview, nothing to optimize
        <img src={receipt.previewUrl} alt="Captured receipt preview" />
      )}
      <Leekly pose="photo" className="preview-photoleek" />
      {error && <p className="scan-error">{error}</p>}
      <div>
        <button className="outline-button" onClick={onRetake}>
          retake
        </button>
        <button className="add-button" onClick={onContinue}>
          continue
        </button>
      </div>
    </div>
  );
}

function ReadingReceipt() {
  return (
    <section className="receipt-loading">
      <Leekly pose="photo" className="loading-photoleek" />
      <p>reading your receipt...</p>
    </section>
  );
}

function dateLabel(draft: ItemView): string {
  if (draft.expiresAt === undefined) return "set a date";
  return draft.checkLabel ? "package date" : "good until";
}

// Inputs save on blur, so a tap on "add to fridge" still sends the last edit first.
function DraftRow({ draft, removed, onSave, onToggleRemove }: {
  draft: ItemView;
  removed: boolean;
  onSave: (patch: { name?: string; expiresAt?: number }) => void;
  onToggleRemove: () => void;
}) {
  return (
    <div className={`parsed-row ${draft.checkLabel ? "needs-date" : ""} ${removed ? "is-removed" : ""}`}>
      <input
        className="parsed-name"
        defaultValue={draft.name}
        disabled={removed}
        aria-label="food name"
        onBlur={(e) => {
          const name = e.target.value.trim();
          if (name && name !== draft.name) onSave({ name });
        }}
      />
      <div className="parsed-controls">
        <label>
          {dateLabel(draft)}
          <input
            type="date"
            defaultValue={draft.expiresAt === undefined ? "" : dateInputValue(draft.expiresAt)}
            disabled={removed}
            aria-label={`date for ${draft.name}`}
            onBlur={(e) => {
              const value = e.target.value;
              if (value && value !== (draft.expiresAt === undefined ? "" : dateInputValue(draft.expiresAt))) {
                onSave({ expiresAt: endOfLocalDay(value) });
              }
            }}
          />
        </label>
        <button className="remove-line" onClick={onToggleRemove} aria-label={removed ? `keep ${draft.name}` : `remove ${draft.name}`}>
          {removed ? "undo" : "×"}
        </button>
      </div>
    </div>
  );
}

function ReceiptReview({ receiptId, onRetake, onDone }: {
  receiptId: Id<"receipts">;
  onRetake: () => void;
  onDone: () => void;
}) {
  const receipt = useQuery(api.receipts.get, { receiptId });
  const update = useMutation(api.itemEdits.update);
  const ackTip = useMutation(api.foods.ackTip);
  const confirm = useMutation(api.receipts.confirmDrafts);
  const [removed, setRemoved] = useState<Id<"items">[]>([]);
  const [dismissedFoods, setDismissedFoods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  if (receipt === undefined || receipt.status === "uploaded" || receipt.status === "parsing") return <ReadingReceipt />;

  if (receipt.status === "failed") {
    return (
      <section className="step-panel">
        <p className="eyebrow">couldn&apos;t read that</p>
        <h1>try another photo.</h1>
        <p className="scan-error">{receipt.error ?? "the receipt couldn't be read."}</p>
        <button className="add-button" onClick={onRetake}>
          retake
        </button>
      </section>
    );
  }

  // Confirming moves every draft into the fridge, so a revisited receipt has none left.
  if (receipt.drafts.length === 0) {
    return (
      <section className="step-panel">
        <p className="eyebrow">all set</p>
        <h1>nothing left to add.</h1>
        <button className="add-button" onClick={onRetake}>
          scan another
        </button>
      </section>
    );
  }

  const tipDraft = receipt.drafts.find(
    (d) => d.showTip && d.storageTip && d.foodId && !dismissedFoods.includes(d.foodId) && !removed.includes(d._id),
  );

  return (
    <section className="step-panel">
      <p className="eyebrow">looks like you bought{receipt.storeName ? ` at ${receipt.storeName.toLowerCase()}` : ""}</p>
      <h1>check the list.</h1>
      <div className="parsed-list">
        {receipt.drafts.map((draft) => (
          <DraftRow
            key={draft._id}
            draft={draft}
            removed={removed.includes(draft._id)}
            onSave={(patch) => update({ itemId: draft._id, ...patch }).catch(() => {})}
            onToggleRemove={() =>
              setRemoved((ids) => (ids.includes(draft._id) ? ids.filter((id) => id !== draft._id) : [...ids, draft._id]))
            }
          />
        ))}
      </div>
      {tipDraft?.storageTip && tipDraft.foodId && (
        <div className="tip-card">
          <span>unknown food tip</span>
          <strong>{tipDraft.name}</strong>
          <p>{tipDraft.storageTip.text}</p>
          <SourceNote source={tipDraft.storageTip.source} />
          <button
            className="outline-button"
            onClick={() => {
              const foodId = tipDraft.foodId;
              if (!foodId) return;
              setDismissedFoods((ids) => [...ids, foodId]);
              ackTip({ foodId }).catch(() => {});
            }}
          >
            got it
          </button>
        </div>
      )}
      <button
        className="add-button mobile-pinned-action"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await confirm({ receiptId, removeItemIds: removed });
            onDone();
          } catch {
            setSaving(false);
          }
        }}
      >
        {saving ? "adding..." : "add to fridge"}
      </button>
    </section>
  );
}

export function ScanFlow({ receiptId, onReceipt, onDone }: {
  receiptId: Id<"receipts"> | null;
  onReceipt: (receiptId: Id<"receipts"> | null) => void;
  onDone: () => void;
}) {
  const generateUploadUrl = useMutation(api.receipts.generateUploadUrl);
  const createReceipt = useMutation(api.receipts.create);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const pick = useCallback(
    (file?: File) => {
      if (!file) return;
      if (receipt) URL.revokeObjectURL(receipt.previewUrl);
      setReceipt({ file, previewUrl: URL.createObjectURL(file) });
      setUploading(false);
      setUploadError(null);
      if (receiptId) onReceipt(null);
    },
    [onReceipt, receipt, receiptId],
  );

  // The header camera button can hand over a photo while this page is open.
  useEffect(() => {
    const onCameraFile = (event: Event) => pick((event as CustomEvent<File>).detail);
    window.addEventListener(CAMERA_FILE_EVENT, onCameraFile);
    return () => window.removeEventListener(CAMERA_FILE_EVENT, onCameraFile);
  }, [pick]);

  const retake = () => {
    if (receipt) URL.revokeObjectURL(receipt.previewUrl);
    setReceipt(null);
    setUploading(false);
    setUploadError(null);
    if (receiptId) onReceipt(null);
  };

  // Uploading on "continue" instead of on pick means a retake never costs a parse.
  const upload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const isPdf = file.type === "application/pdf";
      if (isPdf && file.size > MAX_PDF_BYTES) throw new Error("this pdf is over 20 MB. try a photo instead.");
      const body = isPdf ? file : await shrinkImage(file);
      const res = await fetch(await generateUploadUrl(), {
        method: "POST",
        headers: { "Content-Type": body.type },
        body,
      });
      if (!res.ok) throw new Error("the upload failed. try again.");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      // Stays "uploading" until the URL carries the receipt id, so the preview does not flash back.
      onReceipt(await createReceipt({ fileId: storageId, fileType: isPdf ? "pdf" : "image" }));
    } catch (e) {
      setUploadError(errorMessage(e));
      setUploading(false);
    }
  };

  return (
    <main className="add-screen">
      {receiptId ? (
        <ReceiptReview receiptId={receiptId} onRetake={retake} onDone={onDone} />
      ) : uploading ? (
        <ReadingReceipt />
      ) : receipt ? (
        <section className="step-panel receipt-step">
          <p className="eyebrow">receipt captured</p>
          <h1>take a quick look.</h1>
          <ReceiptPreview
            receipt={receipt}
            error={uploadError}
            onRetake={retake}
            onContinue={() => upload(receipt.file)}
          />
        </section>
      ) : (
        <section className="step-panel scan-step">
          <p className="eyebrow">scan receipt</p>
          <h1>show us your receipt.</h1>
          <ReceiptOptions onPick={pick} onDone={onDone} />
        </section>
      )}
    </main>
  );
}
