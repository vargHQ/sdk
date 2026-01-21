import { expect, test } from "@playwright/test";

test.describe("VideoDecoder debug test", () => {
  test("decodes video frames with WebCodecs", async ({ page }) => {
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("[")) {
        console.log(text);
      }
    });

    await page.goto("http://localhost:3457/video-decode-test.html");

    await page.waitForFunction(
      () =>
        (window as unknown as { testResults: unknown }).testResults !== null,
      { timeout: 120000 },
    );

    const results = await page.evaluate(
      () =>
        (
          window as unknown as {
            testResults: {
              success: boolean;
              framesDecoded?: number;
              error?: string;
            };
          }
        ).testResults,
    );

    console.log("\nTest results:", results);

    if (!results.success) {
      console.error("Test failed:", results.error);
    }

    expect(results.success).toBe(true);
    expect(results.framesDecoded).toBeGreaterThan(0);
  });
});
