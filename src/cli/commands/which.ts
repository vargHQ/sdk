/**
 * varg which command
 * Inspect a specific model, action, or skill
 */

import { defineCommand } from "citty";
import { resolve } from "../../core/registry/resolver";
import { box, c, header, separator } from "../output";
import { getDisplaySchema, handleNotFound } from "../utils";

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
      handleNotFound(name, {
        suggestions: result.suggestions,
        errorColorFn: c.red,
        hintColorFn: c.cyan,
      });
      return; // TypeScript doesn't know handleNotFound exits
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

    const { input, output } = getDisplaySchema(item);

    content.push(header("INPUT SCHEMA"));
    content.push("");
    const properties = input.properties ?? {};
    const required = input.required ?? [];
    if (Object.keys(properties).length > 0) {
      for (const [key, prop] of Object.entries(properties)) {
        const hasDefault = prop.default !== undefined;
        const req = required.includes(key) && !hasDefault;
        const reqTag = req ? c.yellow("*") : " ";
        const defaultVal = hasDefault
          ? c.dim(` [default: ${prop.default}]`)
          : "";
        const enumVals = prop.enum ? c.dim(` [${prop.enum.join(", ")}]`) : "";
        content.push(
          `    ${reqTag} ${key.padEnd(15)} ${c.dim(`<${prop.type}>`)} ${prop.description ?? ""}${defaultVal}${enumVals}`,
        );
      }
    } else {
      content.push(c.dim("    (no schema defined)"));
    }
    content.push("");

    content.push(header("OUTPUT"));
    content.push(`    ${output.description ?? "(no description)"}`);
    content.push("");

    content.push(separator());
    content.push("");
    content.push(`  run with ${c.cyan(`varg run ${item.name} [options]`)}`);
    content.push("");

    console.log(box(item.name, content));
  },
});
