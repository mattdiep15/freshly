"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ParsedReceiptLine } from "@/app/_demo/fixtures";
import { CAMERA_FILE_EVENT } from "@/app/_components/cameraFile";
import { Leekly } from "@/app/_components/ui/Leekly";
import { SourceNote } from "@/app/_components/ui/SourceNote";

type Receipt = { file: File; previewUrl: string };

// TODO(release): replace the fixed delay with the p1-02 receipt parse status.
const DEMO_READING_MS = 850;

function ReceiptOptions({ onPick }: { onPick: (file?: File) => void }) {
  return (
    <div className="receipt-options">
      <label className="receipt-choice">
        <input type="file" accept="image/*" capture="environment" onChange={(e) => onPick(e.target.files?.[0])} />
        <Leekly pose="photo" className="scan-mascot" />
        <span className="camera-choice-copy">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M4 10h6l2-3h8l2 3h6v16H4z" />
            <circle cx="16" cy="18" r="5" />
          </svg>
          <strong>take a photo</strong>
          <small>open your camera</small>
        </span>
      </label>
      <label className="receipt-choice">
        <input type="file" accept="image/*,.pdf" onChange={(e) => onPick(e.target.files?.[0])} />
        <span className="receipt-icon">↑</span>
        <svg className="upload-file-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 2h9l5 5v15H5zM14 2v5h5" />
        </svg>
        <strong>upload from files</strong>
        <small>photo or pdf</small>
      </label>
    </div>
  );
}

function ReceiptPreview({ receipt, onRetake, onContinue }: {
  receipt: Receipt;
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

function ParsedList({ lines }: { lines: ParsedReceiptLine[] }) {
  return (
    <div className="parsed-list">
      {lines.map((line) => (
        <div className="parsed-row" key={line.name}>
          <span>{line.name}</span>
          <label>
            good for
            <input
              type="number"
              min={0}
              defaultValue={line.shelfLifeDays}
              placeholder="not sourced"
              aria-label={`days ${line.name} keeps`}
            />
            days
          </label>
        </div>
      ))}
    </div>
  );
}

export function ScanFlow({ parsedLines, onDone }: { parsedLines: ParsedReceiptLine[]; onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [reading, setReading] = useState(false);
  const readingTimer = useRef<number | undefined>(undefined);
  const tipLine = parsedLines.find((line) => line.storageTip);

  const pick = useCallback((file?: File) => {
    if (!file) return;
    setReceipt({ file, previewUrl: URL.createObjectURL(file) });
    setReading(true);
    window.clearTimeout(readingTimer.current);
    readingTimer.current = window.setTimeout(() => {
      setReading(false);
      setStep(2);
    }, DEMO_READING_MS);
  }, []);

  // The header camera button can hand over a photo while this page is open.
  useEffect(() => {
    const onCameraFile = (event: Event) => pick((event as CustomEvent<File>).detail);
    window.addEventListener(CAMERA_FILE_EVENT, onCameraFile);
    return () => {
      window.removeEventListener(CAMERA_FILE_EVENT, onCameraFile);
      window.clearTimeout(readingTimer.current);
    };
  }, [pick]);

  const retake = () => {
    if (receipt) URL.revokeObjectURL(receipt.previewUrl);
    setReceipt(null);
    setStep(1);
  };

  return (
    <main className="add-screen">
      <div className="step-count">0{step} / 03</div>
      {reading && (
        <section className="receipt-loading">
          <Leekly pose="photo" className="loading-photoleek" />
          <p>reading your receipt...</p>
        </section>
      )}
      {!reading && step === 1 && (
        <section className="step-panel">
          <p className="eyebrow">scan receipt</p>
          <h1>show us your receipt.</h1>
          <ReceiptOptions onPick={pick} />
        </section>
      )}
      {!reading && step === 2 && receipt && (
        <section className="step-panel receipt-step">
          <p className="eyebrow">receipt captured</p>
          <h1>take a quick look.</h1>
          <ReceiptPreview receipt={receipt} onRetake={retake} onContinue={() => setStep(3)} />
        </section>
      )}
      {!reading && step === 3 && (
        <section className="step-panel">
          <p className="eyebrow">looks like you bought</p>
          <h1>check the list.</h1>
          <ParsedList lines={parsedLines} />
          {tipLine?.storageTip && (
            <div className="tip-card">
              <span>unknown food tip</span>
              <strong>{tipLine.name}</strong>
              <p>{tipLine.storageTip.text}</p>
              <SourceNote source={tipLine.storageTip.source} />
            </div>
          )}
          <button className="add-button mobile-pinned-action" onClick={onDone}>
            add to fridge
          </button>
        </section>
      )}
    </main>
  );
}
