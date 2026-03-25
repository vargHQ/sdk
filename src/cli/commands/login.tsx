/**
 * vargai login — agent-first authentication
 *
 * Flow:
 * 1. Prompt for email
 * 2. Send OTP via app → Supabase
 * 3. Prompt for 6-digit code
 * 4. Verify OTP → get API key + access token
 * 5. Save API key to ~/.varg/credentials
 * 6. Show credit packages selector
 * 7. Open Stripe checkout in browser (if selected)
 */

import { defineCommand } from "citty";
import {
  getCredentials,
  getCredentialsPath,
  saveCredentials,
} from "../credentials";

const APP_URL = process.env.VARG_APP_URL ?? "https://app.varg.ai";

const COLORS = {
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

const log = {
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

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function maskApiKey(key: string): string {
  if (key.length <= 16) return key;
  return `${key.slice(0, 12)}...${key.slice(-4)}`;
}

async function readLine(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  return new Promise<string>((resolve) => {
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data) => {
      resolve(data.toString().trim());
    });
  });
}

async function openBrowser(url: string): Promise<void> {
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

async function loginFlow(): Promise<void> {
  console.log();
  console.log(
    `${COLORS.bold}${COLORS.cyan}varg${COLORS.reset}${COLORS.dim} — ai video infrastructure${COLORS.reset}`,
  );
  console.log();

  // Check if already logged in
  const existing = getCredentials();
  if (existing) {
    console.log(
      `${COLORS.dim}Already logged in as ${COLORS.reset}${COLORS.bold}${existing.email}${COLORS.reset}`,
    );
    console.log(
      `${COLORS.dim}API key: ${maskApiKey(existing.api_key)}${COLORS.reset}`,
    );
    console.log();

    const answer = await readLine(
      `${COLORS.yellow}Log in as a different account?${COLORS.reset} (y/N): `,
    );

    if (answer.toLowerCase() !== "y") {
      log.info("Keeping existing credentials.");
      return;
    }
    console.log();
  }

  // Step 1: Get email
  log.step("Sign in to varg.ai");
  console.log();

  const email = await readLine(`  Enter your email: `);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    log.error("Invalid email address.");
    process.exit(1);
  }

  // Step 2: Send OTP
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
    process.stdout.write("\r\x1b[K"); // Clear line
    log.error(err.error ?? "Failed to send verification code.");
    process.exit(1);
  }

  process.stdout.write("\r\x1b[K"); // Clear line
  log.success("Code sent! Check your inbox.");
  console.log();

  // Step 3: Get OTP code (up to 3 attempts)
  let apiKey = "";
  let userEmail = "";
  let balanceCents = 0;
  let accessToken = "";

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
      process.exit(1);
    }

    // Step 4: Verify OTP
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
      process.stdout.write("\r\x1b[K"); // Clear line

      if (verifyRes.status === 401 && attempt < 2) {
        log.error(err.error ?? "Invalid code.");
        console.log(
          `${COLORS.dim}  Try again (${2 - attempt} attempts left)${COLORS.reset}`,
        );
        continue;
      }

      log.error(err.error ?? "Verification failed.");
      process.exit(1);
    }

    const result = (await verifyRes.json()) as {
      api_key: string;
      email: string;
      balance_cents: number;
      access_token: string;
    };

    process.stdout.write("\r\x1b[K"); // Clear line

    apiKey = result.api_key;
    userEmail = result.email;
    balanceCents = result.balance_cents;
    accessToken = result.access_token;
    break;
  }

  if (!apiKey) {
    log.error("Failed to authenticate.");
    process.exit(1);
  }

  // Step 5: Save credentials
  saveCredentials({
    api_key: apiKey,
    email: userEmail,
    created_at: new Date().toISOString(),
  });

  console.log();
  log.success(`Logged in as ${COLORS.bold}${userEmail}${COLORS.reset}`);
  log.success(
    `API key saved to ${COLORS.dim}${getCredentialsPath()}${COLORS.reset}`,
  );
  log.success(
    `Balance: ${COLORS.bold}${balanceCents.toLocaleString()} credits${COLORS.reset} (${formatCents(balanceCents)})`,
  );

  // Step 6: Credit packages selector
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
    console.log();
    printGetStarted();
    return;
  }

  const pkgIndex = parseInt(selection, 10) - 1;
  if (isNaN(pkgIndex) || pkgIndex < 0 || pkgIndex >= CREDIT_PACKAGES.length) {
    log.warn("Invalid selection. Skipping.");
    console.log();
    printGetStarted();
    return;
  }

  const selectedPkg = CREDIT_PACKAGES[pkgIndex]!;

  // Step 7: Create Stripe checkout session via the app
  process.stdout.write(
    `\n${COLORS.dim}  ● Creating checkout session...${COLORS.reset}`,
  );

  const checkoutRes = await fetch(`${APP_URL}/api/billing/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ packageId: selectedPkg.id }),
  });

  if (!checkoutRes.ok) {
    process.stdout.write("\r\x1b[K"); // Clear line
    const err = (await checkoutRes.json().catch(() => ({}))) as {
      error?: string;
    };
    log.error(err.error ?? "Failed to create checkout session.");
    console.log();
    log.info(
      `You can add credits later at ${COLORS.cyan}https://app.varg.ai${COLORS.reset}`,
    );
    console.log();
    printGetStarted();
    return;
  }

  const { url } = (await checkoutRes.json()) as { url: string };

  process.stdout.write("\r\x1b[K"); // Clear line

  log.success("Opening Stripe checkout in your browser...");
  console.log();

  await openBrowser(url);

  console.log(
    `${COLORS.dim}  If the browser didn't open, visit:${COLORS.reset}`,
  );
  console.log(`  ${COLORS.cyan}${url}${COLORS.reset}`);
  console.log();
  log.info("Credits will be added to your account after payment.");
  console.log();
  printGetStarted();
}

function printGetStarted(): void {
  console.log(`${COLORS.bold}Get started:${COLORS.reset}`);
  console.log(
    `  ${COLORS.cyan}vargai init${COLORS.reset}      ${COLORS.dim}Set up a new project${COLORS.reset}`,
  );
  console.log(
    `  ${COLORS.cyan}vargai render${COLORS.reset}    ${COLORS.dim}Render a video${COLORS.reset}`,
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
    await loginFlow();
  },
});
