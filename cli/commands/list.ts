/**
 * varg list command
 * discover what's available by scanning filesystem
 */

import { discoverActions } from "../discover";
import { box, c, header, separator, table } from "../ui";

export async function listCommand(_filter?: string) {
  const actions = await discoverActions();

  const content: string[] = [];
  content.push("");

  content.push(header("ACTIONS"));
  content.push("");

  const rows = actions.map((a) => ({
    name: a.name,
    description: `${a.inputType} → ${a.outputType}`.padEnd(20) + a.description,
  }));

  content.push(...table(rows));
  content.push("");

  content.push(separator());
  content.push("");
  content.push(
    `  ${actions.length} actions · run ${c.cyan("varg <action> --help")} for details`,
  );
  content.push("");

  console.log(box("varg", content));
}
