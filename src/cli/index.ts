#!/usr/bin/env bun

/**
 * varg cli
 * ai video infrastructure from your terminal
 */

import { defineCommand, runMain } from "citty";
import { registry } from "../core/registry";
import { allDefinitions } from "../definitions";
import { providers } from "../providers";
import { findCmd, helpCmd, listCmd, runCmd, whichCmd } from "./commands";

// Register all providers
import "../providers"; // Side effect: registers providers

// Register all definitions
for (const definition of allDefinitions) {
  registry.register(definition);
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
