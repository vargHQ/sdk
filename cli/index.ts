#!/usr/bin/env bun

/**
 * varg cli
 * ai video infrastructure from your terminal
 */

import { findCommand } from "./commands/find";
import { helpCommand, versionCommand } from "./commands/help";
import { listCommand } from "./commands/list";
import { runCommand } from "./commands/run";
import { whichCommand } from "./commands/which";
import { c } from "./ui";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  // handle flags
  if (command === "--version" || command === "-v") {
    versionCommand();
    return;
  }

  if (command === "--help" || command === "-h" || !command) {
    helpCommand();
    return;
  }

  // handle commands
  switch (command) {
    case "run":
      await runCommand(args.slice(1));
      break;

    case "list":
    case "ls":
      await listCommand(args[1]);
      break;

    case "find":
    case "search":
      await findCommand(args.slice(1).join(" "));
      break;

    case "which":
    case "inspect":
      await whichCommand(args[1] || "");
      break;

    case "help":
      helpCommand();
      break;

    case "version":
      versionCommand();
      break;

    default:
      // try to run as model/action directly
      if (command && !command.startsWith("-")) {
        await runCommand(args);
      } else {
        console.error(`${c.red("error:")} unknown command '${command}'`);
        console.log(`\nrun ${c.cyan("varg help")} for usage`);
        process.exit(1);
      }
  }
}

main().catch((err) => {
  console.error(`${c.red("error:")} ${err.message}`);
  process.exit(1);
});
