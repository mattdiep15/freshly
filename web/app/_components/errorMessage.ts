// Convex wraps server errors in request ids and a stack; keep the line a person can act on.
export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "something went wrong.";
  return error.message.match(/Uncaught Error: (.+)/)?.[1] ?? error.message;
}
