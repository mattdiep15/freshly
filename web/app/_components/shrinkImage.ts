// Mirrors MAX_IMAGE_BYTES and IMAGE_TYPES in convex/receiptsNode.ts, which rejects anything else.
const MAX_IMAGE_BYTES = 3.75 * 1024 * 1024;
const PARSEABLE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
// Long receipts need the height to stay legible; 2000 px JPEG is about 1 MB.
const MAX_EDGE_PX = 2000;

// Re-encodes phone photos that are too big or in a format the parser rejects (such as HEIC).
export async function shrinkImage(file: File): Promise<Blob> {
  if (file.size <= MAX_IMAGE_BYTES && PARSEABLE_TYPES.includes(file.type)) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("couldn't shrink this photo."))), "image/jpeg", 0.85),
  );
}
