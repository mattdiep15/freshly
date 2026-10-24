"use node";

import { v } from "convex/values";
import webpush from "web-push";
import { deliverPush, type PushTarget } from "../lib/pushDelivery";
import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";

export type PushPayload = { title: string; body: string; url: string; notificationId?: string };
export type DeliveryResult = { sent: number; gone: string[]; failed: string[] };
export type PushTestResult = DeliveryResult & { subscriptions: number; payload: PushPayload };

async function pushToAll(ctx: ActionCtx, targets: PushTarget[], payload: PushPayload): Promise<DeliveryResult> {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) throw new Error("VAPID_* env vars are not set");
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const result = await deliverPush(targets, JSON.stringify(payload), (t, body) =>
    webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, body),
  );
  if (result.gone.length > 0) await ctx.runMutation(internal.push.deleteByEndpoints, { endpoints: result.gone });
  if (result.failed.length > 0) console.warn(`push failed for ${result.failed.length} subscription(s)`);
  return result;
}

export const send = internalAction({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }): Promise<DeliveryResult> => {
    const delivery = await ctx.runQuery(internal.push.deliveryFor, { notificationId });
    if (!delivery || delivery.subscriptions.length === 0) return { sent: 0, gone: [], failed: [] };
    const { title, body } = delivery.notification;
    return await pushToAll(ctx, delivery.subscriptions, { title, body, url: "/", notificationId });
  },
});

export const sendTest = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<PushTestResult> => {
    const subscriptions = await ctx.runQuery(internal.push.subscriptionsFor, { userId });
    const payload: PushPayload = { title: "Freshly test push", body: "Push notifications are working.", url: "/" };
    return { subscriptions: subscriptions.length, payload, ...(await pushToAll(ctx, subscriptions, payload)) };
  },
});
