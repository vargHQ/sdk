/**
 * varg list command
 * Discover what's available in the registry
 */

import { defineCommand } from "citty";
import { registry } from "../../core/registry";
import { box, c, header, separator, table } from "../output";
import { definitionsToRows } from "../utils";

export const listCmd = defineCommand({
  meta: {
    name: "list",
    description: "discover what's available",
  },
  args: {
    type: {
      type: "positional",
      description: "filter by type (model, action, skill)",
      required: false,
    },
  },
  async run({ args }) {
    const filterType = args.type as "model" | "action" | "skill" | undefined;
    const definitions = registry.list(filterType);

    const content: string[] = [];
    content.push("");

    // Group by type
    const models = definitions.filter((d) => d.type === "model");
    const actions = definitions.filter((d) => d.type === "action");
    const skills = definitions.filter((d) => d.type === "skill");

    if (!filterType || filterType === "model") {
      content.push(header("MODELS"));
      content.push("");
      if (models.length > 0) {
        content.push(...table(definitionsToRows(models)));
      } else {
        content.push(c.dim("    no models registered"));
      }
      content.push("");
    }

    if (!filterType || filterType === "action") {
      content.push(header("ACTIONS"));
      content.push("");
      if (actions.length > 0) {
        content.push(...table(definitionsToRows(actions)));
      } else {
        content.push(c.dim("    no actions registered"));
      }
      content.push("");
    }

    if (!filterType || filterType === "skill") {
      content.push(header("SKILLS"));
      content.push("");
      if (skills.length > 0) {
        content.push(...table(definitionsToRows(skills)));
      } else {
        content.push(c.dim("    no skills registered"));
      }
      content.push("");
    }

    content.push(separator());
    content.push("");

    const stats = registry.stats;
    content.push(
      `  ${stats.models} models · ${stats.actions} actions · ${stats.skills} skills`,
    );
    content.push("");
    content.push(`  run ${c.cyan("varg run <name> --info")} for details`);
    content.push("");

    console.log(box("varg", content));
  },
});
