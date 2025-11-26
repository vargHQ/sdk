/**
 * varg find command
 * fuzzy search by scanning filesystem
 */

import { defineCommand } from "citty";
import { search } from "../discover";
import { box, c, header, separator } from "../ui";

export const findCmd = defineCommand({
  meta: {
    name: "find",
    description: "fuzzy search for models/actions",
  },
  args: {
    query: {
      type: "positional",
      description: "search query",
      required: true,
    },
  },
  async run({ args }) {
    const query = args.query;

    if (!query) {
      console.error(`${c.red("error:")} search query required`);
      console.log(`\nusage: ${c.cyan("varg find <query>")}`);
      process.exit(1);
    }

    const results = await search(query);

    if (results.length === 0) {
      console.log(`\nno matches for "${query}"`);
      console.log(`\ntry ${c.cyan("varg list")} to see all available actions`);
      return;
    }

    const content: string[] = [];
    content.push("");
    content.push(header("MATCHES"));
    content.push("");

    for (const action of results) {
      content.push(
        `  ${c.cyan(action.name.padEnd(16))}${action.inputType} → ${action.outputType}`,
      );
    }

    content.push("");
    content.push(separator());
    content.push("");
    content.push(`  run ${c.cyan("varg run <name> --help")} for usage`);
    content.push("");

    console.log(box(`search: "${query}"`, content));
  },
});
