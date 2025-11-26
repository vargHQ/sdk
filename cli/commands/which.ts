/**
 * varg which command
 * inspect an action by scanning filesystem
 */

import { defineCommand } from "citty";
import { resolve } from "../discover";
import { box, c, header, separator } from "../ui";

export const whichCmd = defineCommand({
  meta: {
    name: "which",
    description: "inspect what's behind an action",
  },
  args: {
    name: {
      type: "positional",
      description: "action name",
      required: true,
    },
  },
  async run({ args }) {
    const name = args.name;

    if (!name) {
      console.error(`${c.red("error:")} action name required`);
      console.log(`\nusage: ${c.cyan("varg which <name>")}`);
      process.exit(1);
    }

    const item = await resolve(name);

    if (!item) {
      console.error(`${c.red("error:")} '${name}' not found`);
      console.log(`\nrun ${c.cyan("varg list")} to see available actions`);
      process.exit(1);
    }

    const content: string[] = [];
    content.push("");
    content.push(`  ${item.description}`);
    content.push("");

    content.push(header("SCHEMA"));
    content.push("");

    for (const [key, prop] of Object.entries(item.schema.input.properties)) {
      const required = item.schema.input.required.includes(key);
      const reqTag = required ? c.yellow("*") : " ";
      const defaultVal = prop.default
        ? c.dim(` (default: ${prop.default})`)
        : "";
      content.push(
        `  ${reqTag}${c.cyan(key.padEnd(12))}${prop.description}${defaultVal}`,
      );
    }

    content.push("");
    content.push(separator());
    content.push("");
    content.push(`  run ${c.cyan(`varg run ${name} --info`)} for full options`);
    content.push("");

    console.log(box(`action: ${name}`, content));
  },
});
