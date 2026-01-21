import { editlyWeb } from "../index";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (e) {
    const error = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
    results.push({ name, passed: false, error });
    console.error(`✗ ${name}: ${error}`);
  }
}

async function checkSupport() {
  const support = {
    VideoEncoder: typeof VideoEncoder !== "undefined",
    VideoFrame: typeof VideoFrame !== "undefined",
    OffscreenCanvas: typeof OffscreenCanvas !== "undefined",
    WebGL2: false,
  };

  if (support.OffscreenCanvas) {
    const canvas = new OffscreenCanvas(100, 100);
    const gl = canvas.getContext("webgl2");
    support.WebGL2 = !!gl;
  }

  console.log("Browser support:", support);
  return support;
}

async function runTests() {
  const status = document.getElementById("status");
  if (status) status.textContent = "Checking browser support...";

  const support = await checkSupport();
  if (status) status.textContent = "Running tests...";

  await runTest("creates video with fill-color", async () => {
    const result = await editlyWeb({
      width: 320,
      height: 240,
      fps: 10,
      clips: [
        { duration: 0.5, layers: [{ type: "fill-color", color: "#ff0000" }] },
      ],
      sources: new Map(),
    });
    if (!(result instanceof Uint8Array)) throw new Error("Expected Uint8Array");
    if (result.length === 0) throw new Error("Expected non-empty result");
  });

  await runTest("creates linear-gradient", async () => {
    const result = await editlyWeb({
      width: 320,
      height: 240,
      fps: 10,
      clips: [
        {
          duration: 0.5,
          layers: [{ type: "linear-gradient", colors: ["#02aab0", "#00cdac"] }],
        },
      ],
      sources: new Map(),
    });
    if (!(result instanceof Uint8Array)) throw new Error("Expected Uint8Array");
  });

  await runTest("creates radial-gradient", async () => {
    const result = await editlyWeb({
      width: 320,
      height: 240,
      fps: 10,
      clips: [
        {
          duration: 0.5,
          layers: [{ type: "radial-gradient", colors: ["#b002aa", "#ac00cd"] }],
        },
      ],
      sources: new Map(),
    });
    if (!(result instanceof Uint8Array)) throw new Error("Expected Uint8Array");
  });

  await runTest("multiple clips", async () => {
    const result = await editlyWeb({
      width: 320,
      height: 240,
      fps: 10,
      clips: [
        { duration: 0.3, layers: [{ type: "fill-color", color: "#ff0000" }] },
        { duration: 0.3, layers: [{ type: "fill-color", color: "#00ff00" }] },
        { duration: 0.3, layers: [{ type: "fill-color", color: "#0000ff" }] },
      ],
      sources: new Map(),
    });
    if (!(result instanceof Uint8Array)) throw new Error("Expected Uint8Array");
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  if (status) {
    status.textContent = `Tests complete: ${passed} passed, ${failed} failed`;
  }

  (window as unknown as { testResults: TestResult[] }).testResults = results;
}

runTests();
