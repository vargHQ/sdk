import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: ".",
  testMatch: "*.playwright.ts",
  timeout: 60000,
  use: {
    browserName: "chromium",
    headless: true,
    launchOptions: {
      args: [
        "--enable-features=SharedArrayBuffer",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  webServer: {
    command: "bun run test-server.ts",
    cwd: __dirname,
    port: 3456,
    reuseExistingServer: true,
  },
});
