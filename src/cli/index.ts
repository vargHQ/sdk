#!/usr/bin/env bun

/**
 * varg cli
 * ai video infrastructure from your terminal
 */

import { defineCommand, runMain } from "citty";
import { registry } from "../core/registry";
import { allDefinitions } from "../definitions";
import {
  findCmd,
  helpCmd,
  listCmd,
  runCmd,
  showFindHelp,
  showHelp,
  showListHelp,
  showRunHelp,
  showTargetHelp,
  showWhichHelp,
  whichCmd,
} from "./commands";

// Register all providers
import "../providers"; // Side effect: registers providers

// Register all definitions
for (const definition of allDefinitions) {
  registry.register(definition);
}

// Intercept --help and -h to use our custom help views
const args = process.argv.slice(2);
const hasHelp = args.includes("--help") || args.includes("-h");

// Map subcommands to their help functions
const subcommandHelp: Record<string, () => void> = {
  run: showRunHelp,
  list: showListHelp,
  ls: showListHelp,
  find: showFindHelp,
  search: showFindHelp,
  which: showWhichHelp,
  inspect: showWhichHelp,
};

// Handle help for root or subcommands
if (args.length === 0 || args[0] === "help") {
  showHelp();
  process.exit(0);
}

if (hasHelp) {
  const subcommand = args[0];
  // Root --help
  if (subcommand === "--help" || subcommand === "-h") {
    showHelp();
    process.exit(0);
  }

  // Handle subcommand help
  if (subcommand && subcommand in subcommandHelp) {
    const nonHelpArgs = args.filter((a) => a !== "--help" && a !== "-h");

    // "varg run --help" - show run help
    if (nonHelpArgs.length === 1) {
      const helpFn = subcommandHelp[subcommand];
      if (helpFn) {
        helpFn();
        process.exit(0);
      }
    }

    // "varg run <target> --help" - show target-specific help
    if (subcommand === "run" && nonHelpArgs.length === 2) {
      const target = nonHelpArgs[1];
      if (target && showTargetHelp(target)) {
        process.exit(0);
      }
    }
  }
}

const main = defineCommand({
  meta: {
    name: "varg",
    version: "0.3.0",
    description: "ai video infrastructure from your terminal",
  },
  subCommands: {
    run: runCmd,
    list: listCmd,
    ls: listCmd,
    find: findCmd,
    search: findCmd,
    which: whichCmd,
    inspect: whichCmd,
    help: helpCmd,
  },
});

runMain(main);
