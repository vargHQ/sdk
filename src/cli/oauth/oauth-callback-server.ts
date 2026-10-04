/**
 * Temporary localhost HTTP server for receiving OAuth callback redirects.
 *
 * Starts on a random available port, waits for a single GET /callback request
 * with ?code=...&state=..., serves a success/error HTML page to the browser,
 * then shuts down.
 *
 * Used by `vargai login` browser-based OAuth flow.
 */

import { createServer, type Server } from "node:http";

export interface OAuthCallbackResult {
  code: string;
  state: string;
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>varg.ai — Authenticated</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0a; color: #fafafa;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card {
      text-align: center; padding: 3rem 2rem;
      border: 1px solid #262626; border-radius: 12px;
      background: #141414; max-width: 400px;
    }
    .check { font-size: 48px; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #a3a3a3; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">&#10003;</div>
    <h1>Authenticated</h1>
    <p>You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`;

const ERROR_HTML = (msg: string) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>varg.ai — Authentication Failed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0a; color: #fafafa;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card {
      text-align: center; padding: 3rem 2rem;
      border: 1px solid #262626; border-radius: 12px;
      background: #141414; max-width: 400px;
    }
    .icon { font-size: 48px; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #a3a3a3; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10007;</div>
    <h1>Authentication Failed</h1>
    <p>${msg}</p>
  </div>
</body>
</html>`;

/**
 * Start a temporary localhost server to receive an OAuth callback.
 *
 * Returns the port and a promise that resolves when the callback is received.
 * The server auto-shuts down after the callback or the timeout.
 *
 * @param expectedState - The state parameter to verify against CSRF
 * @param timeoutMs - Timeout in ms (default: 5 minutes)
 */
export function startCallbackServer(
  expectedState: string,
  timeoutMs = 5 * 60 * 1000,
): { port: number; result: Promise<OAuthCallbackResult>; close: () => void } {
  let resolveResult: (value: OAuthCallbackResult) => void;
  let rejectResult: (reason: Error) => void;
  let server: Server;
  let timer: ReturnType<typeof setTimeout>;

  const result = new Promise<OAuthCallbackResult>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const shutdown = () => {
    clearTimeout(timer);
    server?.close();
  };

  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost`);

    // Only handle GET /callback
    if (url.pathname !== "/callback") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    // Handle OAuth error response
    if (error) {
      const msg = errorDescription ?? error;
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(ERROR_HTML(msg));
      setTimeout(shutdown, 500);
      rejectResult(new Error(`OAuth error: ${msg}`));
      return;
    }

    // Validate required params
    if (!code || !state) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(ERROR_HTML("Missing code or state parameter."));
      setTimeout(shutdown, 500);
      rejectResult(new Error("Missing code or state in callback"));
      return;
    }

    // Verify state matches (CSRF protection)
    if (state !== expectedState) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(ERROR_HTML("State mismatch — possible CSRF attack."));
      setTimeout(shutdown, 500);
      rejectResult(new Error("State mismatch"));
      return;
    }

    // Success
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(SUCCESS_HTML);
    setTimeout(shutdown, 500);
    resolveResult({ code, state });
  });

  // Listen on a random available port on loopback
  server.listen(0, "127.0.0.1");

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  // Timeout — reject if no callback received within the limit
  timer = setTimeout(() => {
    shutdown();
    rejectResult(new Error("OAuth callback timed out. Please try again."));
  }, timeoutMs);

  return { port, result, close: shutdown };
}
