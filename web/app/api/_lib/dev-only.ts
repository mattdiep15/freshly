// Returns a 404 response in production, so GET shortcuts for mutations stay dev-only.
export function devOnly(): Response | null {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  return null;
}
