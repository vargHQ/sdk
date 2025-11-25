/**
 * varg run command
 * execute actions by scanning filesystem
 */

import { existsSync } from "node:fs";
import { resolve } from "../discover";
import type { Meta } from "../types";
import { box, c, runningBox } from "../ui";

interface RunOptions {
  [key: string]: string | boolean | undefined;
  help?: boolean;
  schema?: boolean;
  json?: boolean;
  quiet?: boolean;
}

function parseArgs(args: string[]): { target: string; options: RunOptions } {
  const options: RunOptions = {};
  let target = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (
        key === "help" ||
        key === "schema" ||
        key === "json" ||
        key === "quiet"
      ) {
        options[key] = true;
      } else {
        const value = args[++i];
        if (value) options[key] = value;
      }
    } else if (!target) {
      target = arg;
    } else {
      // positional args - check if it looks like a file
      if (existsSync(arg) || arg.startsWith("./") || arg.startsWith("/")) {
        if (!options.image && !options.audio) {
          options.image = arg;
        }
      } else if (!options.prompt && !options.text) {
        options.prompt = arg;
      }
    }
  }

  return { target, options };
}

function showHelp(item: Meta) {
  const content: string[] = [];
  content.push("");
  content.push(`  ${item.description}`);
  content.push("");
  content.push(c.bold(c.dim("  USAGE")));
  content.push("");

  const required = item.schema.input.required;
  const reqArgs = required.map((r) => `--${r} <${r}>`).join(" ");
  content.push(`    varg run ${item.name} ${reqArgs} [options]`);

  content.push("");
  content.push(c.bold(c.dim("  OPTIONS")));
  content.push("");

  for (const [key, prop] of Object.entries(item.schema.input.properties)) {
    const req = item.schema.input.required.includes(key);
    const reqTag = req ? c.yellow(" (required)") : "";
    const defaultVal =
      prop.default !== undefined ? c.dim(` default: ${prop.default}`) : "";
    const enumVals = prop.enum ? c.dim(` [${prop.enum.join(", ")}]`) : "";

    content.push(
      `    --${key.padEnd(12)}${prop.description}${reqTag}${defaultVal}${enumVals}`,
    );
  }

  content.push("");
  content.push(`    --json          output result as json`);
  content.push(`    --quiet         minimal output`);
  content.push("");

  console.log(box(`action: ${item.name}`, content));
}

function showSchema(item: Meta) {
  const schema = {
    name: item.name,
    type: item.type,
    description: item.description,
    input: item.schema.input,
    output: item.schema.output,
  };

  console.log(JSON.stringify(schema, null, 2));
}

export async function runCommand(args: string[]) {
  const { target, options } = parseArgs(args);

  if (!target) {
    console.error(`${c.red("error:")} target required`);
    console.log(`\nusage: ${c.cyan("varg run <action> [options]")}`);
    console.log(`\nrun ${c.cyan("varg list")} to see available actions`);
    process.exit(1);
  }

  const item = await resolve(target);

  if (!item) {
    console.error(`${c.red("error:")} '${target}' not found`);
    console.log(`\nrun ${c.cyan("varg list")} to see available actions`);
    process.exit(1);
  }

  if (options.help) {
    showHelp(item);
    return;
  }

  if (options.schema) {
    showSchema(item);
    return;
  }

  // validate required args
  for (const req of item.schema.input.required) {
    if (!options[req]) {
      console.error(`${c.red("error:")} --${req} is required`);
      console.log(`\nrun ${c.cyan(`varg run ${target} --help`)} for usage`);
      process.exit(1);
    }
  }

  // build params for display
  const params: Record<string, string> = {};
  for (const key of Object.keys(item.schema.input.properties)) {
    if (options[key] && typeof options[key] === "string") {
      params[key] = options[key] as string;
    }
  }

  if (!options.quiet && !options.json) {
    console.log(runningBox(target, params, "running"));
  }

  const startTime = Date.now();

  try {
    const result = await item.run(options);
    const elapsed = Date.now() - startTime;

    if (options.json) {
      console.log(JSON.stringify({ success: true, result, time: elapsed }));
    } else if (options.quiet) {
      console.log(JSON.stringify(result));
    } else {
      // extract url from result if present
      const resultObj = result as Record<string, unknown> | null;
      const url =
        resultObj?.imageUrl || resultObj?.videoUrl || resultObj?.url || null;

      console.log("\x1b[2J\x1b[H");
      console.log(
        runningBox(target, params, "done", {
          output: url ? "saved" : "done",
          time: elapsed,
        }),
      );

      // print url outside box so it's clickable
      if (url) {
        console.log(`\n  ${c.cyan("url")}  ${url}\n`);
      }
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (options.json) {
      console.log(
        JSON.stringify({ success: false, error: errorMsg, time: elapsed }),
      );
    } else if (options.quiet) {
      console.error(errorMsg);
    } else {
      console.log("\x1b[2J\x1b[H");
      console.log(
        runningBox(target, params, "error", {
          error: errorMsg,
          time: elapsed,
        }),
      );
    }

    process.exit(1);
  }
}
