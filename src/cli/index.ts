#!/usr/bin/env bun

/**
 * varg cli
 * ai video infrastructure from your terminal
 */

// Must be first import to suppress logs before other modules load
import "./quiet";

import { defineCommand, runMain } from "citty";
import { registry } from "../core/registry";
import { allDefinitions } from "../definitions";
import {
  findCmd,
  frameCmd,
  helloCmd,
  helpCmd,
  initCmd,
  listCmd,
  previewCmd,
  renderCmd,
  runCmd,
  showFindHelp,
  showFrameHelp,
  showHelp,
  showInitHelp,
  showListHelp,
  showPreviewHelp,
  showRenderHelp,
  showRunHelp,
  showStoryboardHelp,
  showTargetHelp,
  showWhichHelp,
  storyboardCmd,
  studioCmd,
  whichCmd,
} from "./commands";

// Register all providers
import "../providers"; // Side effect: registers providers to base registry
import { providers } from "../providers/base";

// Register all definitions
for (const definition of allDefinitions) {
  registry.register(definition);
}

// Also register providers to core registry
for (const provider of providers.all()) {
  registry.registerProvider(provider);
}

// Intercept --help and -h to use our custom help views
const args = process.argv.slice(2);
const hasHelp = args.includes("--help") || args.includes("-h");

const subcommandHelp: Record<string, () => void> = {
  run: showRunHelp,
  render: showRenderHelp,
  preview: showPreviewHelp,
  frame: showFrameHelp,
  storyboard: showStoryboardHelp,
  init: showInitHelp,
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

const pkg = await import("../../package.json");

const main = defineCommand({
  meta: {
    name: "vargai",
    version: pkg.version,
    description: "ai video generation sdk",
  },
  subCommands: {
    hello: helloCmd,
    init: initCmd,
    render: renderCmd,
    preview: previewCmd,
    frame: frameCmd,
    storyboard: storyboardCmd,
    studio: studioCmd,
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
