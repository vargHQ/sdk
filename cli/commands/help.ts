/**
 * varg help command
 */

import { defineCommand } from "citty";
import { box, c, header, separator } from "../ui";

export const helpCmd = defineCommand({
  meta: {
    name: "help",
    description: "show help",
  },
  run() {
    const content: string[] = [];
    content.push("");
    content.push("  AI video infrastructure from your terminal.");
    content.push("");
    content.push(separator());
    content.push("");
    content.push(header("USAGE"));
    content.push("");
    content.push(`  varg ${c.cyan("<command>")} [target] [options]`);
    content.push("");
    content.push(separator());
    content.push("");
    content.push(header("COMMANDS"));
    content.push("");
    content.push(`  ${c.cyan("run".padEnd(12))}run a model or action`);
    content.push(`  ${c.cyan("list".padEnd(12))}discover what's available`);
    content.push(
      `  ${c.cyan("find".padEnd(12))}fuzzy search for models/actions`,
    );
    content.push(
      `  ${c.cyan("which".padEnd(12))}inspect what's behind an action`,
    );
    content.push(`  ${c.cyan("help".padEnd(12))}show this help`);
    content.push("");
    content.push(separator());
    content.push("");
    content.push(header("EXAMPLES"));
    content.push("");
    content.push(`  ${c.dim("# generate video from text")}`);
    content.push(`  varg run kling --prompt "a cat dancing"`);
    content.push("");
    content.push(`  ${c.dim("# animate an image")}`);
    content.push(`  varg run image-to-video --image ./cat.png`);
    content.push("");
    content.push(`  ${c.dim("# transcribe audio")}`);
    content.push(`  varg run transcribe ./video.mp4`);
    content.push("");
    content.push(`  ${c.dim("# see what's available")}`);
    content.push(`  varg list`);
    content.push("");
    content.push(separator());
    content.push("");
    content.push(header("ENVIRONMENT"));
    content.push("");
    content.push(`  ${c.dim("FAL_KEY".padEnd(24))}fal.ai api key`);
    content.push(
      `  ${c.dim("REPLICATE_API_TOKEN".padEnd(24))}replicate api key`,
    );
    content.push(
      `  ${c.dim("ELEVENLABS_API_KEY".padEnd(24))}elevenlabs api key`,
    );
    content.push(`  ${c.dim("GROQ_API_KEY".padEnd(24))}groq api key`);
    content.push("");

    console.log(box("varg", content));
  },
});
