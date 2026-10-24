"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/app/_components/errorMessage";

function inviteLink(code: string) {
  return `${window.location.origin}/community?view=friends&invite=${code}`;
}

// Invite link to share, plus a field for a friend's code.
export function AddFriendPanel() {
  const createCode = useMutation(api.friends.inviteCode);
  const add = useMutation(api.friends.add);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    createCode()
      .then((created) => setLink(inviteLink(created)))
      .catch((e) => setMessage({ text: errorMessage(e), error: true }));
  }, [createCode]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the link stays on screen to copy by hand.
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    try {
      const { name } = await add({ code });
      setCode("");
      setMessage({ text: `added ${name}.`, error: false });
    } catch (e) {
      setMessage({ text: errorMessage(e), error: true });
    }
  };

  return (
    <section className="add-friend-panel" aria-label="Add a friend">
      <p className="eyebrow">your invite link</p>
      <div className="friend-code-row">
        <input readOnly value={link ?? "making your link..."} aria-label="Your invite link" onFocus={(e) => e.target.select()} />
        <button type="button" onClick={copy} disabled={!link}>
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <p className="eyebrow">or enter a friend&rsquo;s code</p>
      <form className="friend-code-row" onSubmit={submit}>
        <input
          value={code}
          placeholder="ABC234"
          aria-label="Friend's invite code"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={12}
          onChange={(event) => setCode(event.target.value)}
        />
        <button type="submit">add</button>
      </form>
      {message && <p className={message.error ? "scan-error" : "friend-added"}>{message.text}</p>}
    </section>
  );
}

// Shown when the page opens from an invite link; nothing is written until the user confirms.
export function InviteConfirm({ code, onDone }: { code: string; onDone: () => void }) {
  const preview = useQuery(api.friends.invitePreview, { code });
  const add = useMutation(api.friends.add);
  const [error, setError] = useState<string | null>(null);
  if (!preview) return null;

  const confirm = async () => {
    try {
      await add({ code });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const text = {
    ok: `add ${preview.name} as a friend?`,
    friends: `you and ${preview.name} are already friends.`,
    self: "that is your own invite link.",
    unknown: "that invite link does not match anyone.",
  }[preview.status];

  return (
    <section className="add-friend-panel invite-confirm" aria-live="polite">
      <strong>{text}</strong>
      <div className="invite-actions">
        {preview.status === "ok" && (
          <button type="button" className="invite-accept" onClick={confirm}>
            add
          </button>
        )}
        <button type="button" className="outline-button" onClick={onDone}>
          {preview.status === "ok" ? "not now" : "ok"}
        </button>
      </div>
      {error && <p className="scan-error">{error}</p>}
    </section>
  );
}
