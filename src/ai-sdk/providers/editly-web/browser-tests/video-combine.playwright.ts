import { expect, test } from "@playwright/test";

test.describe("Video combine tests with HTMLVideoSource", () => {
  test("combines videos and runs all editly-web tests", async ({ page }) => {
    const logs: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      logs.push(`[${msg.type()}] ${text}`);
      console.log(`[browser:${msg.type()}] ${text}`);
    });

    page.on("pageerror", (err) => {
      logs.push(`[pageerror] ${err.message}`);
      console.error(`[browser:pageerror] ${err.message}`);
    });

    await page.goto("http://localhost:3457/video-combine-test.html");

    try {
      await page.waitForFunction(
        () =>
          (window as unknown as { testResults: unknown }).testResults !== null,
        { timeout: 120000 },
      );
    } catch (e) {
      console.error("Timeout waiting for testResults. Browser logs:");
      for (const log of logs) {
        console.log(`  ${log}`);
      }
      throw e;
    }

    const results = await page.evaluate(
      () =>
        (
          window as unknown as {
            testResults: {
              success: boolean;
              passed?: number;
              failed?: number;
              error?: string;
              results?: Array<{
                name: string;
                passed: boolean;
                error?: string;
              }>;
            };
          }
        ).testResults,
    );

    console.log("\n=== Test Results ===");
    if (results?.results) {
      for (const r of results.results) {
        console.log(
          `${r.passed ? "✓" : "✗"} ${r.name}${r.error ? `: ${r.error}` : ""}`,
        );
      }
      console.log(
        `\nTotal: ${results.passed} passed, ${results.failed} failed`,
      );
    } else {
      console.log("No results object:", results);
    }

    expect(results?.success).toBe(true);
  });
});
