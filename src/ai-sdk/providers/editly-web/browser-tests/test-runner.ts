import { editlyWeb } from "../index";
import { HTMLVideoSource } from "../sources";

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

  await runTest("HTMLVideoSource loads video from blob", async () => {
    const mp4Data = await editlyWeb({
      width: 320,
      height: 240,
      fps: 10,
      clips: [
        { duration: 0.5, layers: [{ type: "fill-color", color: "#ff0000" }] },
      ],
      sources: new Map(),
    });

    const buffer = new ArrayBuffer(mp4Data.byteLength);
    new Uint8Array(buffer).set(mp4Data);

    const source = await HTMLVideoSource.create({
      data: buffer,
    });

    if (source.width !== 320)
      throw new Error(`Expected width 320, got ${source.width}`);
    if (source.height !== 240)
      throw new Error(`Expected height 240, got ${source.height}`);
    if (source.duration < 0.4 || source.duration > 0.6) {
      throw new Error(`Expected duration ~0.5, got ${source.duration}`);
    }

    source.close();
  });

  await runTest("HTMLVideoSource extracts frames", async () => {
    const mp4Data = await editlyWeb({
      width: 320,
      height: 240,
      fps: 10,
      clips: [
        { duration: 1.0, layers: [{ type: "fill-color", color: "#ff0000" }] },
      ],
      sources: new Map(),
    });

    const buffer = new ArrayBuffer(mp4Data.byteLength);
    new Uint8Array(buffer).set(mp4Data);

    const source = await HTMLVideoSource.create({
      data: buffer,
    });

    const frame = await source.getFrame(0.5);
    if (frame.codedWidth !== 320)
      throw new Error(`Expected frame width 320, got ${frame.codedWidth}`);
    if (frame.codedHeight !== 240)
      throw new Error(`Expected frame height 240, got ${frame.codedHeight}`);
    frame.close();

    source.close();
  });

  await runTest(
    "HTMLVideoSource re-encodes video through editlyWeb",
    async () => {
      const originalMp4 = await editlyWeb({
        width: 320,
        height: 240,
        fps: 10,
        clips: [
          {
            duration: 0.5,
            layers: [
              { type: "linear-gradient", colors: ["#ff0000", "#0000ff"] },
            ],
          },
        ],
        sources: new Map(),
      });

      const buffer = new ArrayBuffer(originalMp4.byteLength);
      new Uint8Array(buffer).set(originalMp4);

      const sources = new Map<string, ArrayBuffer>();
      sources.set("input.mp4", buffer);

      const reEncodedMp4 = await editlyWeb({
        width: 320,
        height: 240,
        fps: 10,
        clips: [{ layers: [{ type: "video", path: "input.mp4" }] }],
        sources,
        useHTMLVideo: true,
      });

      if (!(reEncodedMp4 instanceof Uint8Array))
        throw new Error("Expected Uint8Array");
      if (reEncodedMp4.length < 1000)
        throw new Error("Re-encoded video too small");
    },
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  if (status) {
    status.textContent = `Tests complete: ${passed} passed, ${failed} failed`;
  }

  (window as unknown as { testResults: TestResult[] }).testResults = results;
}

runTests();
