import { resolve } from "node:path";
import { defineCommand } from "citty";
import { createStudioServer } from "../../studio/server";

export const studioCmd = defineCommand({
  meta: {
    name: "studio",
    description: "launch varg studio - visual editor for workflows",
  },
  args: {
    file: {
      type: "positional",
      description: "initial file to open",
      required: false,
    },
    cache: {
      type: "string",
      description: "cache directory",
      default: ".cache/ai",
    },
    port: {
      type: "string",
      description: "port to run on",
      default: "8282",
    },
  },
  run: async ({ args }) => {
    const initialFile = args.file ? resolve(args.file) : undefined;
    const cacheDir = args.cache;
    const port = Number.parseInt(args.port, 10);

    console.log("varg studio starting...");
    console.log(`cache folder: ${cacheDir}`);
    if (initialFile) {
      console.log(`initial file: ${initialFile}`);
    }

    const server = createStudioServer({ cacheDir, initialFile, port });

    console.log(`\nopen http://localhost:${server.port}`);
    console.log("  /editor - code editor");
    console.log("  /cache  - cache viewer");

    // Keep process alive
    await new Promise(() => {});
  },
});
