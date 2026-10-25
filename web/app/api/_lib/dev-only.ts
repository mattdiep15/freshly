// Returns a 404 response in production unless ALLOW_DEV_ROUTES is set, so GET shortcuts for mutations stay off by default.
export function devOnly(): Response | null {
  // TODO(release): unset ALLOW_DEV_ROUTES on Vercel so these routes 404 in production again.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_ROUTES !== "true") {
    return new Response("Not found", { status: 404 });
  }
  return null;
}
