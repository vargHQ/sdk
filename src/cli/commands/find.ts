/**
 * varg find command
 * Search for models, actions, and skills
 */

import { defineCommand } from "citty";
import { registry } from "../../core/registry";
import { box, c, table } from "../output";
import { definitionsToRows } from "../utils";

export const findCmd = defineCommand({
  meta: {
    name: "find",
    description: "search for models, actions, and skills",
  },
  args: {
    query: {
      type: "positional",
      description: "search query",
      required: true,
    },
    type: {
      type: "string",
      description: "filter by type (model, action, skill)",
    },
  },
  async run({ args }) {
    const query = args.query as string;
    const type = args.type as "model" | "action" | "skill" | undefined;

    const results = registry.search(query, { type });

    if (results.length === 0) {
      console.log(`\n  ${c.yellow("no results found for")} '${query}'\n`);
      console.log(`  try ${c.cyan("varg list")} to see all available items\n`);
      return;
    }

    const content: string[] = [];
    content.push("");

    content.push(...table(definitionsToRows(results)));
    content.push("");
    content.push(
      `  ${c.dim(`${results.length} result${results.length > 1 ? "s" : ""}`)}`,
    );
    content.push("");

    console.log(box(`search: ${query}`, content));
  },
});
