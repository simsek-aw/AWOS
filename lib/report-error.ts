// Lightweight, dependency-free error reporting. Always logs to the server
// console (visible in Vercel function logs); if ERROR_WEBHOOK_URL is set, also
// forwards a JSON payload so you can pipe errors to Slack / Sentry / anything.
// Upgrade path: swap the fetch for a real Sentry SDK later without touching
// call sites.
export async function reportError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[AWOS] ${context}:`, message, extra ?? "");

  const url = process.env.ERROR_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "awos",
        context,
        message,
        stack,
        extra,
        at: new Date().toISOString(),
      }),
    });
  } catch {
    // Never let error reporting throw.
  }
}
