import { resolve } from "node:path";
import { createStudioServer } from "./server";

// Parse arguments: bun run studio [file.tsx] [--cache=.cache/ai]
let initialFile: string | undefined;
let cacheDir = ".cache/ai";

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--cache=")) {
    cacheDir = arg.replace("--cache=", "");
  } else if (arg.endsWith(".tsx") || arg.endsWith(".ts")) {
    initialFile = resolve(arg);
  }
}

console.log("varg studio starting...");
console.log(`cache folder: ${cacheDir}`);
if (initialFile) {
  console.log(`initial file: ${initialFile}`);
}

const { port } = createStudioServer({ cacheDir, initialFile });

console.log(`\nopen http://localhost:${port}`);
console.log("  /editor - code editor");
console.log("  /cache  - cache viewer");
