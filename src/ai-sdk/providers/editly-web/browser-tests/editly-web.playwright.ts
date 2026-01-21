import { expect, test } from "@playwright/test";

test.describe("editly-web browser tests", () => {
  test("runs all tests in browser", async ({ page }) => {
    await page.goto("http://localhost:3456");

    await page.waitForFunction(
      () => (window as unknown as { testResults: unknown[] }).testResults,
      { timeout: 60000 },
    );

    const results = await page.evaluate(
      () =>
        (
          window as unknown as {
            testResults: { name: string; passed: boolean; error?: string }[];
          }
        ).testResults,
    );

    console.log("\nBrowser test results:");
    for (const result of results) {
      if (result.passed) {
        console.log(`  ✓ ${result.name}`);
      } else {
        console.log(`  ✗ ${result.name}: ${result.error}`);
      }
    }

    const failed = results.filter((r) => !r.passed);
    expect(failed).toHaveLength(0);
  });
});
