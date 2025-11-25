/**
 * varg find command
 * fuzzy search for models and actions
 */

import { search } from "../registry";
import { box, c, header, separator } from "../ui";

export function findCommand(query: string) {
  if (!query) {
    console.error(`${c.red("error:")} search query required`);
    console.log(`\nusage: ${c.cyan("varg find <query>")}`);
    process.exit(1);
  }

  const results = search(query);

  if (results.length === 0) {
    console.log(`\nno matches for "${query}"`);
    console.log(`\ntry ${c.cyan("varg list")} to see all available options`);
    return;
  }

  const content: string[] = [];
  content.push("");
  content.push(header("BEST MATCHES"));
  content.push("");

  const models = results.filter((r) => r.type === "model");
  const actions = results.filter((r) => r.type === "action");

  if (actions.length > 0) {
    for (const action of actions) {
      content.push(
        `  ${c.cyan(`action/${action.name}`.padEnd(24))}${action.description}`,
      );
    }
  }

  if (models.length > 0) {
    for (const model of models) {
      content.push(
        `  ${c.cyan(`model/${model.name}`.padEnd(24))}${model.inputType} → ${model.outputType}`,
      );
    }
  }

  content.push("");
  content.push(separator());
  content.push("");
  content.push(`  run ${c.cyan("varg run <name> --help")} for usage`);
  content.push("");

  console.log(box(`search: "${query}"`, content));
}
