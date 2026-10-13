/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.1.
 *
 * Generates a code_verifier (random string) and code_challenge (SHA-256 hash).
 * Used by the CLI browser-based login flow.
 */

import { createHash, randomBytes } from "node:crypto";

/** Base64url-encode a buffer (no padding). */
function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** Generate a random code_verifier (43–128 characters, base64url). */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

/** Generate a code_challenge from a code_verifier (S256). */
export function generateCodeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

/** Generate a random state parameter for CSRF protection. */
export function generateState(): string {
  return base64url(randomBytes(32));
}
