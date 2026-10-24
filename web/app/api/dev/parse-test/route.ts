import { readFile } from "node:fs/promises";
import path from "node:path";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { devOnly } from "../../_lib/dev-only";

const TYPES: Record<string, { fileType: "image" | "pdf"; contentType: string }> = {
  ".jpeg": { fileType: "image", contentType: "image/jpeg" },
  ".jpg": { fileType: "image", contentType: "image/jpeg" },
  ".png": { fileType: "image", contentType: "image/png" },
  ".pdf": { fileType: "pdf", contentType: "application/pdf" },
};

// Uploads data/<name> and starts a parse; mock=1 saves the hand-written expected result instead of calling Claude.
export async function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const params = new URL(req.url).searchParams;
  const name = params.get("name") ?? "";
  const type = TYPES[path.extname(name).toLowerCase()];
  if (!/^[\w.-]+$/.test(name) || !type) return Response.json({ error: "name must be a .jpeg, .png, or .pdf in data/" }, { status: 400 });

  const file = await readFile(path.join(process.cwd(), "data", name));
  const uploadUrl = await fetchMutation(api.receipts.generateUploadUrl, {});
  const upload = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": type.contentType }, body: file });
  const { storageId } = (await upload.json()) as { storageId: Id<"_storage"> };

  if (params.get("mock") !== "1") {
    return Response.json({ receiptId: await fetchMutation(api.receipts.create, { fileId: storageId, fileType: type.fileType }) });
  }
  // TODO(release): remove the mock path with receipts.devCreateParsed
  const fixture = path.join(process.cwd(), "convex", "data", "receipt-fixtures", `${path.parse(name).name}.expected.json`);
  const { isReceipt, storeName, purchasedAt, totalCents, lines } = JSON.parse(await readFile(fixture, "utf8"));
  const result = { isReceipt, storeName, purchasedAt, totalCents, lines };
  const receiptId = await fetchMutation(api.receipts.devCreateParsed, { fileId: storageId, fileType: type.fileType, result });
  return Response.json({ receiptId, mock: true });
}
