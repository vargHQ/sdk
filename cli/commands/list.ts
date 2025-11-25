/**
 * varg list command
 * discover what's available
 */

import { actions, models } from "../registry";
import { box, c, header, separator, table } from "../ui";

export function listCommand(filter?: string) {
  const showModels = !filter || filter === "models";
  const showActions = !filter || filter === "actions";

  const content: string[] = [];
  content.push("");

  if (showModels) {
    content.push(header("MODELS"));
    content.push("");

    const modelRows = Object.values(models).map((m) => ({
      name: m.name,
      description:
        `${m.inputType} → ${m.outputType}`.padEnd(24) +
        c.dim(m.providers.join(" · ")),
    }));

    content.push(...table(modelRows));
    content.push("");
  }

  if (showActions) {
    if (showModels) {
      content.push(separator());
      content.push("");
    }

    content.push(header("ACTIONS"));
    content.push("");

    const actionRows = Object.values(actions).map((a) => ({
      name: a.name,
      description:
        a.description.padEnd(26) +
        c.dim(a.routesTo.map((r) => r.model).join(", ")),
    }));

    content.push(...table(actionRows));
    content.push("");
  }

  content.push(separator());
  content.push("");

  const modelCount = Object.keys(models).length;
  const actionCount = Object.keys(actions).length;
  content.push(
    `  ${modelCount} models · ${actionCount} actions · run ${c.cyan("varg <cmd> --help")} for details`,
  );
  content.push("");

  console.log(box("varg", content));
}
