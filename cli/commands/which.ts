/**
 * varg which command
 * inspect what's behind an action
 */

import { resolve } from "../registry";
import { box, c, header, separator } from "../ui";

export function whichCommand(name: string) {
  const item = resolve(name);

  if (!item) {
    console.error(`${c.red("error:")} '${name}' not found`);
    console.log(
      `\nrun ${c.cyan("varg list")} to see available models and actions`,
    );
    process.exit(1);
  }

  const content: string[] = [];
  content.push("");
  content.push(`  ${item.description}`);
  content.push("");

  if (item.type === "action") {
    content.push(header("ROUTES TO"));
    content.push("");

    for (const route of item.routesTo) {
      const defaultTag = route.isDefault ? `${c.green("default")} · ` : "";
      content.push(
        `  ${c.cyan(route.model.padEnd(14))}${defaultTag}${route.description}`,
      );
    }

    content.push("");
    content.push(separator());
    content.push("");

    // selection logic
    content.push(header("SELECTION LOGIC"));
    content.push("");

    const defaultRoute = item.routesTo.find((r) => r.isDefault);
    if (defaultRoute) {
      content.push(
        `  ${c.dim("default →")} ${defaultRoute.model} (${defaultRoute.description})`,
      );
    }

    for (const route of item.routesTo.filter((r) => !r.isDefault)) {
      content.push(
        `  ${c.dim(`--model ${route.model} →`)} ${route.description}`,
      );
    }

    content.push("");
  } else {
    // model
    content.push(header("PROVIDERS"));
    content.push("");

    for (const provider of item.providers) {
      const isDefault = provider === item.defaultProvider;
      const tag = isDefault ? c.green(" (default)") : "";
      content.push(`  ${c.cyan(provider)}${tag}`);
    }

    content.push("");
    content.push(separator());
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
  }

  content.push(separator());
  content.push("");
  content.push(`  run ${c.cyan(`varg run ${name} --help`)} for full options`);
  content.push("");

  const titleType = item.type === "action" ? "action" : "model";
  console.log(box(`${titleType}: ${name}`, content));
}
