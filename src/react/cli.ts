#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { render } from "./render";
import type { VargElement } from "./types";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    output: { type: "string", short: "o" },
    cache: { type: "string", short: "c", default: ".cache/ai" },
    quiet: { type: "boolean", short: "q", default: false },
  },
  allowPositionals: true,
});

const [file] = positionals;

if (!file) {
  console.error("usage: bun react/cli.ts <component.tsx> [-o output.mp4]");
  process.exit(1);
}

const resolvedPath = Bun.resolveSync(file, process.cwd());
const mod = await import(resolvedPath);
const component: VargElement = mod.default;

if (!component || component.type !== "render") {
  console.error("error: default export must be a <Render> element");
  process.exit(1);
}

const outputPath =
  values.output ??
  `output/${file
    .replace(/\.tsx?$/, "")
    .split("/")
    .pop()}.mp4`;

if (!values.quiet) {
  console.log(`rendering ${file} → ${outputPath}`);
}

const buffer = await render(component, {
  output: outputPath,
  cache: values.cache,
  quiet: values.quiet,
});

if (!values.quiet) {
  console.log(`done! ${buffer.byteLength} bytes → ${outputPath}`);
}
