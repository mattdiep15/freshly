"use client";

import { useState } from "react";
import { numberWord } from "@/lib/freshness";
import type { ParsedReceiptLine } from "@/app/_demo/fixtures";
import { SourceNote } from "@/components/ui/SourceNote";

type Receipt = { file: File; previewUrl: string };

function ReceiptPicker({ receipt, onPick, onRetake, onContinue }: {
  receipt: Receipt | null;
  onPick: (file?: File) => void;
  onRetake: () => void;
  onContinue: () => void;
}) {
  if (receipt) {
    return (
      <div className="receipt-preview">
        {receipt.file.type === "application/pdf" ? (
          <p className="receipt-file">{receipt.file.name}</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview, nothing to optimize
          <img src={receipt.previewUrl} alt="Captured receipt preview" />
        )}
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

  return (
    <div className="receipt-options">
      <label className="receipt-choice">
        <input type="file" accept="image/*" capture="environment" onChange={(e) => onPick(e.target.files?.[0])} />
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M4 10h6l2-3h8l2 3h6v16H4z" />
          <circle cx="16" cy="18" r="5" />
        </svg>
        <strong>take a photo</strong>
        <small>open your camera</small>
      </label>
      <label className="receipt-choice">
        <input type="file" accept="image/*,.pdf" onChange={(e) => onPick(e.target.files?.[0])} />
        <span className="receipt-icon">↑</span>
        <strong>upload from files</strong>
        <small>photo or pdf</small>
      </label>
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
  const tipLine = parsedLines.find((line) => line.storageTip);

  const pick = (file?: File) => {
    if (file) setReceipt({ file, previewUrl: URL.createObjectURL(file) });
  };

  const retake = () => {
    if (receipt) URL.revokeObjectURL(receipt.previewUrl);
    setReceipt(null);
  };

  return (
    <main className="add-screen">
      <div className="step-count">0{step} / 03</div>
      {step === 1 && (
        <section className="step-panel">
          <p className="eyebrow">scan receipt</p>
          <h1>show us your receipt.</h1>
          <ReceiptPicker receipt={receipt} onPick={pick} onRetake={retake} onContinue={() => setStep(2)} />
        </section>
      )}
      {step === 2 && (
        <section className="step-panel">
          <p className="eyebrow">looks like you bought</p>
          <h1>check the list.</h1>
          <ParsedList lines={parsedLines} />
          {tipLine?.storageTip && (
            <div className="tip-card">
              <span>new food tip</span>
              <strong>{tipLine.name}</strong>
              <p>{tipLine.storageTip.text}</p>
              <SourceNote source={tipLine.storageTip.source} />
            </div>
          )}
          <button className="add-button" onClick={() => setStep(3)}>
            everything looks right
          </button>
        </section>
      )}
      {step === 3 && (
        <section className="step-panel final-step">
          <p className="eyebrow">ready when you are</p>
          <h1>
            {numberWord(parsedLines.length)} items.
            <br />
            zero fuss.
          </h1>
          <button className="add-button large" onClick={onDone}>
            add to fridge <span>→</span>
          </button>
        </section>
      )}
    </main>
  );
}
