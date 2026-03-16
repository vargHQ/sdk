/**
 * Render all async examples into MP4 videos.
 */
import { render } from "../../render";
import type { VargElement } from "../../types";

async function renderExample(name: string, path: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Rendering: ${name}`);
  console.log("=".repeat(60));

  const start = Date.now();
  try {
    const mod = await import(path);
    let element = mod.default;

    if (typeof element === "function") {
      element = await element();
    }

    const result = await render(element as VargElement, { quiet: true });

    const outputPath = `output/async-${name}.mp4`;
    await Bun.write(outputPath, result.video);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `OK → ${outputPath} (${(result.video.byteLength / 1024).toFixed(0)} KB) in ${elapsed}s`,
    );
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`FAILED (${elapsed}s): ${(err as Error).message}`);
  }
}

await renderExample("simple", "./simple.tsx");
await renderExample("simple-with-deps", "./simple-with-deps.tsx");
await renderExample("talking-head", "./talking-head.tsx");
await renderExample("strawberry-vs-chocolate", "./example_we_want_to_test.tsx");

console.log(`\n${"=".repeat(60)}`);
console.log("All done.");
