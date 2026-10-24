import { describe, expect, test } from "vitest";
import { deliverPush, type PushTarget } from "./pushDelivery";

const target = (endpoint: string): PushTarget => ({ endpoint, p256dh: "p", auth: "a" });
const httpError = (statusCode: number) => Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });

describe("deliverPush", () => {
  test("sends the payload to every target", async () => {
    const calls: [string, string][] = [];
    const result = await deliverPush([target("a"), target("b")], '{"title":"t"}', async (t, p) => {
      calls.push([t.endpoint, p]);
    });
    expect(calls).toEqual([
      ["a", '{"title":"t"}'],
      ["b", '{"title":"t"}'],
    ]);
    expect(result).toEqual({ sent: 2, gone: [], failed: [] });
  });

  test("404 and 410 mark a subscription gone; other errors do not", async () => {
    const status: Record<string, number> = { e404: 404, e410: 410, e500: 500, e429: 429 };
    const result = await deliverPush(
      ["ok", "e404", "e410", "e500", "e429"].map(target),
      "{}",
      async (t) => {
        if (status[t.endpoint]) throw httpError(status[t.endpoint]);
      },
    );
    expect(result).toEqual({ sent: 1, gone: ["e404", "e410"], failed: ["e500", "e429"] });
  });

  test("an error without a status code is a plain failure", async () => {
    const result = await deliverPush([target("x")], "{}", async () => {
      throw new Error("network down");
    });
    expect(result).toEqual({ sent: 0, gone: [], failed: ["x"] });
  });
});
