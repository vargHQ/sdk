/**
 * varg help command
 */

import { defineCommand } from "citty";
import { box, c, header } from "../output";

export const helpCmd = defineCommand({
  meta: {
    name: "help",
    description: "show help",
  },
  async run() {
    const content: string[] = [];
    content.push("");
    content.push("  ai video infrastructure from your terminal");
    content.push("");

    content.push(header("COMMANDS"));
    content.push("");
    content.push(
      `    ${c.cyan("run".padEnd(12))} run a model, action, or skill`,
    );
    content.push(`    ${c.cyan("list".padEnd(12))} discover what's available`);
    content.push(
      `    ${c.cyan("find".padEnd(12))} search for models, actions, skills`,
    );
    content.push(`    ${c.cyan("which".padEnd(12))} inspect a specific item`);
    content.push(`    ${c.cyan("help".padEnd(12))} show this help`);
    content.push("");

    content.push(header("EXAMPLES"));
    content.push("");
    content.push(`    ${c.dim("# generate a video from text")}`);
    content.push(`    varg run video --prompt "ocean waves"`);
    content.push("");
    content.push(`    ${c.dim("# generate video from image")}`);
    content.push(
      `    varg run video --prompt "person talking" --image photo.jpg`,
    );
    content.push("");
    content.push(`    ${c.dim("# text to speech")}`);
    content.push(`    varg run voice --text "hello world" --voice sam`);
    content.push("");
    content.push(`    ${c.dim("# see all available actions")}`);
    content.push(`    varg list`);
    content.push("");
    content.push(`    ${c.dim("# get detailed info about an action")}`);
    content.push(`    varg run video --info`);
    content.push("");

    console.log(box("varg", content));
  },
});
