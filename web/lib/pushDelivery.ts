export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushSender = (target: PushTarget, payload: string) => Promise<unknown>;

// Push services answer 404 or 410 when a subscription is gone for good.
export function isGoneError(err: unknown): boolean {
  const status = (err as { statusCode?: unknown } | null)?.statusCode;
  return status === 404 || status === 410;
}

export async function deliverPush(targets: PushTarget[], payload: string, send: PushSender) {
  const gone: string[] = [];
  const failed: string[] = [];
  let sent = 0;
  for (const target of targets) {
    try {
      await send(target, payload);
      sent++;
    } catch (err) {
      (isGoneError(err) ? gone : failed).push(target.endpoint);
    }
  }
  return { sent, gone, failed };
}
