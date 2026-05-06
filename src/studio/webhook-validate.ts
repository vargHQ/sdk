const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
];

const ALLOWED_HOSTS = process.env.ALLOWED_WEBHOOK_HOSTS?.split(",").map((h) =>
  h.trim().toLowerCase(),
);

export function isPrivateWebhookUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return true;
  }

  if (parsed.protocol !== "https:") return true;

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "localhost" || hostname === "::1") return true;
  if (PRIVATE_RANGES.some((r) => r.test(hostname))) return true;

  if (ALLOWED_HOSTS && !ALLOWED_HOSTS.includes(hostname)) return true;

  return false;
}
