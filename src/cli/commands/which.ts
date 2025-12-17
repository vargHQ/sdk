/**
 * varg which command
 * Inspect a specific model, action, or skill
 */

import { defineCommand } from "citty";
import { resolve } from "../../core/registry/resolver";
import { box, c, header, separator } from "../output";

export const whichCmd = defineCommand({
  meta: {
    name: "which",
    description: "inspect a model, action, or skill",
  },
  args: {
    name: {
      type: "positional",
      description: "name to inspect",
      required: true,
    },
    json: {
      type: "boolean",
      description: "output as json",
    },
  },
  async run({ args }) {
    const name = args.name as string;
    const result = resolve(name, { fuzzy: true });

    if (!result.definition) {
      console.error(`\n  ${c.red("not found:")} '${name}'\n`);
      if (result.suggestions && result.suggestions.length > 0) {
        console.log(
          `  did you mean: ${result.suggestions.slice(0, 3).join(", ")}?\n`,
        );
      }
      process.exit(1);
    }

    const item = result.definition;

    if (args.json) {
      console.log(JSON.stringify(item, null, 2));
      return;
    }

    const content: string[] = [];
    content.push("");
    content.push(`  ${item.description}`);
    content.push("");

    content.push(header("TYPE"));
    content.push(`    ${item.type}`);
    content.push("");

    // Show providers for models
    if (item.type === "model") {
      content.push(header("PROVIDERS"));
      content.push(`    ${item.providers.join(", ")}`);
      content.push(`    ${c.dim(`default: ${item.defaultProvider}`)}`);
      content.push("");
    }

    // Show routes for actions
    if (item.type === "action" && item.routes.length > 0) {
      content.push(header("ROUTES"));
      for (const route of item.routes) {
        const conditions = route.when
          ? ` ${c.dim(`when ${JSON.stringify(route.when)}`)}`
          : "";
        content.push(`    → ${route.target}${conditions}`);
      }
      content.push("");
    }

    // Show steps for skills
    if (item.type === "skill") {
      content.push(header("STEPS"));
      for (let i = 0; i < item.steps.length; i++) {
        const step = item.steps[i];
        if (!step) continue;
        content.push(`    ${i + 1}. ${step.name} → ${step.run}`);
      }
      content.push("");
    }

    content.push(header("INPUT SCHEMA"));
    content.push("");
    for (const [key, prop] of Object.entries(item.schema.input.properties)) {
      const req = item.schema.input.required.includes(key)
        ? c.yellow("*")
        : " ";
      const type = c.dim(`<${prop.type}>`);
      content.push(`    ${req} ${key.padEnd(15)} ${type} ${prop.description}`);
    }
    content.push("");

    content.push(header("OUTPUT"));
    content.push(`    ${item.schema.output.description}`);
    content.push("");

    content.push(separator());
    content.push("");
    content.push(`  run with ${c.cyan(`varg run ${item.name} [options]`)}`);
    content.push("");

    console.log(box(item.name, content));
  },
});
