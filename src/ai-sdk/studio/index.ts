import { createStudioServer } from "./server";

const cacheDir = process.argv[2] || ".cache/ai";

console.log("varg studio starting...");
console.log(`cache folder: ${cacheDir}`);

const { port } = createStudioServer({ cacheDir });

console.log(`\nopen http://localhost:${port}`);
console.log("  /editor - code editor");
console.log("  /cache  - cache viewer");
