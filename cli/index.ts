#!/usr/bin/env bun

/**
 * varg cli
 * ai video infrastructure from your terminal
 */

import { defineCommand, runMain } from "citty";
import { findCmd } from "./commands/find";
import { helpCmd } from "./commands/help";
import { listCmd } from "./commands/list";
import { runCmd } from "./commands/run";
import { uploadCmd } from "./commands/upload";
import { whichCmd } from "./commands/which";

const main = defineCommand({
  meta: {
    name: "varg",
    version: "0.2.0",
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
    upload: uploadCmd,
    help: helpCmd,
  },
});

runMain(main);
