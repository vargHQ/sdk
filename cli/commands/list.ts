/**
 * varg list command
 * discover what's available by scanning filesystem
 */

import { defineCommand } from "citty";
import { discoverActions } from "../discover";
import { box, c, header, separator, table } from "../ui";

export const listCmd = defineCommand({
  meta: {
    name: "list",
    description: "discover what's available",
  },
  args: {
    filter: {
      type: "positional",
      description: "filter by type",
      required: false,
    },
  },
  async run() {
    const actions = await discoverActions();

    const content: string[] = [];
    content.push("");

    content.push(header("ACTIONS"));
    content.push("");

    const rows = actions.map((a) => ({
      name: a.name,
      description:
        `${a.inputType} → ${a.outputType}`.padEnd(20) + a.description,
    }));

    content.push(...table(rows));
    content.push("");

    content.push(separator());
    content.push("");
    content.push(
      `  ${actions.length} actions · run ${c.cyan("varg run <action> --info")} for details`,
    );
    content.push("");

    console.log(box("varg", content));
  },
});
