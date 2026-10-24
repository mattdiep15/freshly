"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function PushSubscribeButton() {
  const saveSubscription = useMutation(api.push.saveSubscription);
  const [status, setStatus] = useState("Not subscribed in this browser yet.");

  async function subscribe() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("This browser does not support web push.");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setStatus("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set in .env.local.");
        return;
      }
      if ((await Notification.requestPermission()) !== "granted") {
        setStatus("Notification permission was not granted.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      const { endpoint, keys } = subscription.toJSON();
      if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error("Subscription is missing its keys");
      await saveSubscription({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
      setStatus("Subscribed. Open /api/dev/push-test to send a test push.");
    } catch (err) {
      setStatus(`Subscribe failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={subscribe} className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black">
        Subscribe
      </button>
      <p role="status">{status}</p>
    </div>
  );
}
