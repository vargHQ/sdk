/**
 * vargai login — agent-first authentication
 *
 * Three modes:
 *   1. Browser   — OAuth via browser (recommended, supports Google + email)
 *   2. Email OTP — sign in via email magic code (creates account + API key)
 *   3. API key   — paste an existing API key directly
 *
 * The `runLogin()` function is exported so `init` can embed the login flow.
 */

import { defineCommand } from "citty";
import {
  getCredentials,
  getCredentialsPath,
  saveCredentials,
} from "../credentials";
import { startCallbackServer } from "../oauth/oauth-callback-server";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "../oauth/pkce";

const APP_URL = process.env.VARG_APP_URL ?? "https://app.varg.ai";
const GATEWAY_URL = process.env.VARG_GATEWAY_URL ?? "https://api.varg.ai";
const MCP_URL = process.env.VARG_MCP_URL ?? "https://mcp.varg.ai";

export const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

export const log = {
  info: (msg: string) =>
    console.log(`${COLORS.blue}info${COLORS.reset} ${msg}`),
  success: (msg: string) =>
    console.log(`${COLORS.green} ✓${COLORS.reset}  ${msg}`),
  error: (msg: string) => console.log(`${COLORS.red} ✗${COLORS.reset}  ${msg}`),
  warn: (msg: string) =>
    console.log(`${COLORS.yellow} !${COLORS.reset}  ${msg}`),
  step: (msg: string) =>
    console.log(
      `\n${COLORS.bold}${COLORS.cyan}==>${COLORS.reset} ${COLORS.bold}${msg}${COLORS.reset}`,
    ),
};

// Credit packages (mirrored from app/src/config/credit-packages.ts)
const CREDIT_PACKAGES = [
  {
    id: "credits-2000",
    credits: 2000,
    amountCents: 2000,
    label: "2,000 credits",
  },
  {
    id: "credits-5000",
    credits: 5000,
    amountCents: 5000,
    label: "5,000 credits",
  },
  {
    id: "credits-10000",
    credits: 10000,
    amountCents: 10000,
    label: "10,000 credits",
    popular: true,
  },
  {
    id: "credits-20000",
    credits: 20000,
    amountCents: 20000,
    label: "20,000 credits",
  },
  {
    id: "credits-50000",
    credits: 50000,
    amountCents: 50000,
    label: "50,000 credits",
  },
  {
    id: "credits-100000",
    credits: 100000,
    amountCents: 100000,
    label: "100,000 credits",
  },
];

// Common disposable email domains for fast client-side rejection.
// The server enforces a comprehensive 55k+ domain blocklist (mailchecker);
// this is just for instant UX feedback on the most common offenders.
const DISPOSABLE_DOMAINS = new Set([
  "guerrillamail.com",
  "guerrillamailblock.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.de",
  "grr.la",
  "sharklasers.com",
  "guerrilla.ml",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "mailinator.com",
  "mailinator2.com",
  "throwaway.email",
  "trashmail.com",
  "trashmail.net",
  "trashmail.me",
  "10minutemail.com",
  "10minutemail.net",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mailnesia.com",
  "tempail.com",
  "tempr.email",
  "discard.email",
  "discardmail.com",
  "mohmal.com",
  "burpcollaborator.net",
]);

function isDisposableDomain(domain: string): boolean {
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  for (const d of DISPOSABLE_DOMAINS) {
    if (domain.endsWith(`.${d}`)) return true;
  }
  return false;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function maskApiKey(key: string): string {
  if (key.length <= 16) return key;
  return `${key.slice(0, 12)}...${key.slice(-4)}`;
}

export async function readLine(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  return new Promise<string>((resolve) => {
    process.stdin.setEncoding("utf8");
    process.stdin.ref();
    process.stdin.resume();
    process.stdin.once("data", (data) => {
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
}

export async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  try {
    if (platform === "darwin") {
      Bun.spawn(["open", url]);
    } else if (platform === "linux") {
      Bun.spawn(["xdg-open", url]);
    } else if (platform === "win32") {
      Bun.spawn(["cmd", "/c", "start", url]);
    } else {
      log.warn(`Could not open browser. Visit this URL manually:\n  ${url}`);
    }
  } catch {
    log.warn(`Could not open browser. Visit this URL manually:\n  ${url}`);
  }
}

// ──── Login Result ────

export interface LoginResult {
  apiKey: string;
  email: string;
  balanceCents: number;
  /** Only available after email OTP login, not API key login */
  accessToken: string;
}

// ──── Browser OAuth Login ────

async function loginWithBrowser(): Promise<LoginResult | null> {
  // Generate PKCE pair
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Start temporary localhost server for callback
  const {
    port,
    result: callbackResult,
    close: closeServer,
  } = startCallbackServer(state);
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  try {
    // Register as a dynamic client with the MCP OAuth server
    process.stdout.write(
      `${COLORS.dim}  ● Preparing authentication...${COLORS.reset}`,
    );

    const registerRes = await fetch(`${MCP_URL}/oauth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redirect_uris: [redirectUri],
        client_name: "varg CLI",
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
      }),
    });

    if (!registerRes.ok) {
      process.stdout.write("\r\x1b[K");
      log.error(
        "Failed to initialize authentication. Try again or use email login.",
      );
      closeServer();
      return null;
    }

    const client = (await registerRes.json()) as { client_id: string };
    process.stdout.write("\r\x1b[K");

    // Build authorization URL
    const authUrl = new URL(`${MCP_URL}/oauth/authorize`);
    authUrl.searchParams.set("client_id", client.client_id);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", "mcp:tools");

    // Open browser
    console.log();
    log.info("Opening browser to authenticate...");
    await openBrowser(authUrl.toString());

    console.log();
    console.log(
      `${COLORS.dim}  If the browser didn't open, visit:${COLORS.reset}`,
    );
    console.log(`  ${COLORS.cyan}${authUrl.toString()}${COLORS.reset}`);
    console.log();
    process.stdout.write(
      `${COLORS.dim}  ● Waiting for authorization... (press Ctrl+C to cancel)${COLORS.reset}`,
    );

    // Wait for the OAuth callback
    const { code } = await callbackResult;
    process.stdout.write("\r\x1b[K");

    // Exchange auth code for access token (API key)
    process.stdout.write(
      `${COLORS.dim}  ● Completing authentication...${COLORS.reset}`,
    );

    const tokenRes = await fetch(`${MCP_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: codeVerifier,
        client_id: client.client_id,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      process.stdout.write("\r\x1b[K");
      const err = (await tokenRes.json().catch(() => ({}))) as {
        error_description?: string;
      };
      log.error(err.error_description ?? "Token exchange failed.");
      return null;
    }

    const token = (await tokenRes.json()) as {
      access_token: string;
      token_type: string;
    };

    process.stdout.write("\r\x1b[K");

    // Validate the API key and get balance
    const balanceRes = await fetch(`${GATEWAY_URL}/v1/balance`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    let balanceCents = 0;
    if (balanceRes.ok) {
      const data = (await balanceRes.json()) as { balance_cents: number };
      balanceCents = data.balance_cents;
    }

    return {
      apiKey: token.access_token,
      email: "", // email is not returned via OAuth token exchange
      balanceCents,
      accessToken: "", // not available via OAuth flow
    };
  } catch (err) {
    process.stdout.write("\r\x1b[K");
    closeServer();

    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timed out")) {
      log.error("Authentication timed out. Please try again.");
    } else if (message.includes("State mismatch")) {
      log.error("Security check failed. Please try again.");
    } else {
      log.error(`Authentication failed: ${message}`);
    }
    return null;
  }
}

// ──── API Key Login ────

async function loginWithApiKey(): Promise<LoginResult | null> {
  console.log();
  console.log(
    `${COLORS.dim}  Paste your API key from ${COLORS.reset}${COLORS.cyan}https://app.varg.ai${COLORS.reset}`,
  );
  console.log();

  for (let attempt = 0; attempt < 3; attempt++) {
    const key = await readLine(`  API key: `);

    if (!key) {
      log.error("No key entered.");
      if (attempt < 2) {
        console.log(
          `${COLORS.dim}  Try again (${2 - attempt} attempts left)${COLORS.reset}`,
        );
        continue;
      }
      return null;
    }

    // Validate by calling the gateway balance endpoint
    process.stdout.write(
      `${COLORS.dim}  ● Validating API key...${COLORS.reset}`,
    );

    try {
      const res = await fetch(`${GATEWAY_URL}/v1/balance`, {
        headers: { Authorization: `Bearer ${key}` },
      });

      if (!res.ok) {
        process.stdout.write("\r\x1b[K");
        if (res.status === 401 || res.status === 403) {
          log.error("Invalid API key.");
        } else {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string | { message?: string };
          };
          const errMsg =
            typeof body.error === "string"
              ? body.error
              : (body.error?.message ?? `Validation failed (${res.status})`);
          log.error(errMsg);
        }

        if (attempt < 2) {
          console.log(
            `${COLORS.dim}  Try again (${2 - attempt} attempts left)${COLORS.reset}`,
          );
          continue;
        }
        return null;
      }

      const data = (await res.json()) as { balance_cents: number };
      process.stdout.write("\r\x1b[K");

      return {
        apiKey: key,
        email: "", // unknown for direct API key login
        balanceCents: data.balance_cents,
        accessToken: "", // not available for API key login
      };
    } catch {
      process.stdout.write("\r\x1b[K");
      log.error("Failed to connect to gateway. Check your connection.");
      if (attempt < 2) {
        console.log(
          `${COLORS.dim}  Try again (${2 - attempt} attempts left)${COLORS.reset}`,
        );
        continue;
      }
      return null;
    }
  }

  return null;
}

// ──── Email OTP Login ────

async function loginWithEmail(): Promise<LoginResult | null> {
  console.log();

  const email = await readLine(`  Enter your email: `);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    log.error("Invalid email address.");
    return null;
  }

  // Quick client-side check for common disposable email domains.
  // The server enforces a comprehensive 55k+ domain blocklist (mailchecker);
  // this is just for faster UX feedback on the most common offenders.
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && isDisposableDomain(domain)) {
    log.error(
      "Disposable email addresses are not allowed. Please use a permanent email address.",
    );
    return null;
  }

  // Send OTP
  console.log();
  process.stdout.write(
    `${COLORS.dim}  ● Sending verification code...${COLORS.reset}`,
  );

  const sendRes = await fetch(`${APP_URL}/api/auth/cli/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!sendRes.ok) {
    const err = (await sendRes.json().catch(() => ({}))) as { error?: string };
    process.stdout.write("\r\x1b[K");
    log.error(err.error ?? "Failed to send verification code.");
    return null;
  }

  process.stdout.write("\r\x1b[K");
  log.success("Code sent! Check your inbox.");
  console.log();

  // Get OTP code (up to 3 attempts)
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = await readLine(`  Enter the 6-digit code: `);

    if (!code || !/^\d{6}$/.test(code)) {
      log.error("Code must be 6 digits.");
      if (attempt < 2) {
        console.log(
          `${COLORS.dim}  Try again (${2 - attempt} attempts left)${COLORS.reset}`,
        );
        continue;
      }
      return null;
    }

    process.stdout.write(`${COLORS.dim}  ● Verifying...${COLORS.reset}`);

    const verifyRes = await fetch(`${APP_URL}/api/auth/cli/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    if (!verifyRes.ok) {
      const err = (await verifyRes.json().catch(() => ({}))) as {
        error?: string;
      };
      process.stdout.write("\r\x1b[K");

      if (verifyRes.status === 401 && attempt < 2) {
        log.error(err.error ?? "Invalid code.");
        console.log(
          `${COLORS.dim}  Try again (${2 - attempt} attempts left)${COLORS.reset}`,
        );
        continue;
      }

      log.error(err.error ?? "Verification failed.");
      return null;
    }

    const result = (await verifyRes.json()) as {
      api_key: string;
      email: string;
      balance_cents: number;
      access_token: string;
    };

    process.stdout.write("\r\x1b[K");

    return {
      apiKey: result.api_key,
      email: result.email,
      balanceCents: result.balance_cents,
      accessToken: result.access_token,
    };
  }

  return null;
}

// ──── Credit Package Selector ────

export async function showCreditPackages(accessToken: string): Promise<void> {
  // Need an access token for Stripe checkout — only available after email login
  if (!accessToken) {
    console.log();
    console.log(
      `${COLORS.dim}  Add credits anytime with ${COLORS.cyan}vargai topup${COLORS.reset}${COLORS.dim} or at ${COLORS.cyan}https://app.varg.ai${COLORS.reset}`,
    );
    return;
  }

  console.log();
  console.log(
    `${COLORS.dim}───${COLORS.reset} ${COLORS.bold}Add credits${COLORS.reset} ${COLORS.dim}${"─".repeat(40)}${COLORS.reset}`,
  );
  console.log();

  for (let i = 0; i < CREDIT_PACKAGES.length; i++) {
    const pkg = CREDIT_PACKAGES[i]!;
    const num = `[${i + 1}]`;
    const popular = pkg.popular
      ? `  ${COLORS.yellow}★ popular${COLORS.reset}`
      : "";
    const price = formatCents(pkg.amountCents).padStart(7);
    console.log(
      `  ${COLORS.cyan}${num}${COLORS.reset}  ${pkg.label.padEnd(18)} ${COLORS.dim}-${COLORS.reset}  ${COLORS.bold}${price}${COLORS.reset}${popular}`,
    );
  }

  console.log();
  console.log(`  ${COLORS.dim}[s]  Skip for now${COLORS.reset}`);
  console.log();

  const selection = await readLine(
    `  Select a package (1-${CREDIT_PACKAGES.length}) or [s] to skip: `,
  );

  if (selection.toLowerCase() === "s" || selection === "") {
    return;
  }

  const pkgIndex = parseInt(selection, 10) - 1;
  if (isNaN(pkgIndex) || pkgIndex < 0 || pkgIndex >= CREDIT_PACKAGES.length) {
    log.warn("Invalid selection. Skipping.");
    return;
  }

  const selectedPkg = CREDIT_PACKAGES[pkgIndex]!;

  // Create Stripe checkout session
  process.stdout.write(
    `\n${COLORS.dim}  ● Creating checkout session...${COLORS.reset}`,
  );

  const checkoutRes = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      Origin: APP_URL,
    },
    body: JSON.stringify({ packageId: selectedPkg.id }),
  });

  if (!checkoutRes.ok) {
    process.stdout.write("\r\x1b[K");
    const err = (await checkoutRes.json().catch(() => ({}))) as {
      error?: string;
    };
    log.error(err.error ?? "Failed to create checkout session.");
    console.log();
    log.info(
      `You can add credits anytime with ${COLORS.cyan}vargai topup${COLORS.reset} or at ${COLORS.cyan}https://app.varg.ai${COLORS.reset}`,
    );
    return;
  }

  const { url } = (await checkoutRes.json()) as { url: string };

  process.stdout.write("\r\x1b[K");

  log.success("Opening Stripe checkout in your browser...");
  console.log();

  await openBrowser(url);

  console.log(
    `${COLORS.dim}  If the browser didn't open, visit:${COLORS.reset}`,
  );
  console.log(`  ${COLORS.cyan}${url}${COLORS.reset}`);
  console.log();
  log.info("Credits will be added to your account after payment.");
}

// ──── Main Login Flow (exported for use by init) ────

export interface RunLoginOptions {
  /** Show credit package selector after login. Default: true */
  showPackages?: boolean;
  /** Show the header banner. Default: true */
  showHeader?: boolean;
  /** Skip the "already logged in" check. Default: false */
  forceLogin?: boolean;
}

/**
 * Run the interactive login flow. Returns the login result, or null if
 * the user cancelled / was already logged in and chose to keep credentials.
 *
 * Can be called from `vargai login` or embedded in `vargai init`.
 */
export async function runLogin(
  options: RunLoginOptions = {},
): Promise<LoginResult | null> {
  const {
    showPackages = true,
    showHeader = true,
    forceLogin = false,
  } = options;

  if (showHeader) {
    console.log();
    console.log(
      `${COLORS.bold}${COLORS.cyan}varg${COLORS.reset}${COLORS.dim} — ai video infrastructure${COLORS.reset}`,
    );
    console.log();
  }

  // Check if already logged in
  if (!forceLogin) {
    const existing = getCredentials();
    if (existing) {
      const emailLabel = existing.email
        ? existing.email
        : maskApiKey(existing.api_key);
      console.log(
        `${COLORS.dim}Already logged in as ${COLORS.reset}${COLORS.bold}${emailLabel}${COLORS.reset}`,
      );
      if (existing.email) {
        console.log(
          `${COLORS.dim}API key: ${maskApiKey(existing.api_key)}${COLORS.reset}`,
        );
      }
      console.log();

      const answer = await readLine(
        `${COLORS.yellow}Log in as a different account?${COLORS.reset} (y/N): `,
      );

      if (answer.toLowerCase() !== "y") {
        log.info("Keeping existing credentials.");
        return null;
      }
      console.log();
    }
  }

  // Mode selector
  log.step("Sign in to varg.ai");
  console.log();
  console.log(
    `  ${COLORS.cyan}[1]${COLORS.reset}  Browser ${COLORS.dim}— sign in via browser (recommended)${COLORS.reset}`,
  );
  console.log(
    `  ${COLORS.cyan}[2]${COLORS.reset}  Email ${COLORS.dim}— sign in with your email (creates account if needed)${COLORS.reset}`,
  );
  console.log(
    `  ${COLORS.cyan}[3]${COLORS.reset}  API key ${COLORS.dim}— paste an existing API key${COLORS.reset}`,
  );
  console.log();

  const mode = await readLine(`  Select login method (1-3): `);

  let result: LoginResult | null = null;

  if (mode === "2") {
    result = await loginWithEmail();
  } else if (mode === "3") {
    result = await loginWithApiKey();
  } else {
    // Default to browser login (mode "1" or anything else)
    result = await loginWithBrowser();
  }

  if (!result) {
    log.error("Login failed.");
    return null;
  }

  // Save credentials
  saveCredentials({
    api_key: result.apiKey,
    email: result.email,
    created_at: new Date().toISOString(),
  });

  console.log();
  if (result.email) {
    log.success(`Logged in as ${COLORS.bold}${result.email}${COLORS.reset}`);
  } else {
    log.success("API key validated and saved.");
  }
  log.success(
    `API key saved to ${COLORS.dim}${getCredentialsPath()}${COLORS.reset}`,
  );
  log.success(
    `Balance: ${COLORS.bold}${result.balanceCents.toLocaleString()} credits${COLORS.reset} (${formatCents(result.balanceCents)})`,
  );

  // Credit packages
  if (showPackages) {
    await showCreditPackages(result.accessToken);
  }

  return result;
}

// ──── Get Started Message ────

function printGetStarted(): void {
  console.log();
  console.log(`${COLORS.bold}Get started:${COLORS.reset}`);
  console.log(
    `  ${COLORS.cyan}vargai init${COLORS.reset}      ${COLORS.dim}Set up a new project${COLORS.reset}`,
  );
  console.log(
    `  ${COLORS.cyan}vargai render${COLORS.reset}    ${COLORS.dim}Render a video${COLORS.reset}`,
  );
  console.log(
    `  ${COLORS.cyan}vargai topup${COLORS.reset}     ${COLORS.dim}Add credits to your account${COLORS.reset}`,
  );
  console.log();
}

// ──── Command Definition ────

export const loginCmd = defineCommand({
  meta: {
    name: "login",
    description: "sign in to varg.ai and get your API key",
  },
  async run() {
    try {
      const result = await runLogin({ showPackages: true, showHeader: true });
      if (result) {
        printGetStarted();
      }
    } finally {
      // Allow process to exit cleanly after interactive prompts
      process.stdin.unref();
    }
  },
});
