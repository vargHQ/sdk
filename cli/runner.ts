/**
 * shared cli runner for actions
 * parses args and calls meta.run()
 */

import type { Meta } from "./types";

export async function runCli(meta: Meta) {
  const args = process.argv.slice(2);

  if (args[0] === "help" || args[0] === "--help" || args.length === 0) {
    console.log(`
${meta.name} - ${meta.description}

usage:
  bun run action/${meta.name} [options]

options:`);

    for (const [key, prop] of Object.entries(meta.schema.input.properties)) {
      const req = meta.schema.input.required.includes(key) ? " (required)" : "";
      const def =
        prop.default !== undefined ? ` [default: ${prop.default}]` : "";
      console.log(`  --${key.padEnd(14)} ${prop.description}${req}${def}`);
    }

    console.log(`
examples:
  bun run action/${meta.name} --${meta.schema.input.required[0]} "value"
`);
    return;
  }

  // parse args
  const options: Record<string, unknown> = {};
  const firstRequired = meta.schema.input.required[0];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[++i];
      options[key] = value;
    } else if (arg && firstRequired && !options[firstRequired]) {
      // first positional arg goes to first required field
      options[firstRequired] = arg;
    }
  }

  // validate required
  for (const req of meta.schema.input.required) {
    if (!options[req]) {
      console.error(`error: --${req} is required`);
      process.exit(1);
    }
  }

  try {
    const result = await meta.run(options);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
