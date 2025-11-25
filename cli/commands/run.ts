/**
 * varg run command
 * execute models and actions
 */

import { existsSync, writeFileSync } from "node:fs";
import { transcribe } from "../../action/transcribe";
import { generateVoice } from "../../action/voice";
import { generateImage, imageToVideo, textToVideo, wan25 } from "../../lib/fal";
import { MODELS as REPLICATE_MODELS, runVideo } from "../../lib/replicate";
import { type ActionDef, type ModelDef, resolve } from "../registry";
import { box, c, runningBox } from "../ui";

interface RunOptions {
  prompt?: string;
  image?: string;
  audio?: string;
  duration?: number | string;
  provider?: string;
  output?: string;
  json?: boolean;
  quiet?: boolean;
  schema?: boolean;
  help?: boolean;
  text?: string;
  voice?: string;
  size?: string;
  resolution?: string;
  model?: string;
  aspect?: string;
}

function parseArgs(args: string[]): { target: string; options: RunOptions } {
  const options: RunOptions = {};
  let target = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) throw new Error(`missing arg`);

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (
        key === "help" ||
        key === "schema" ||
        key === "json" ||
        key === "quiet"
      ) {
        (options as Record<string, boolean>)[key] = true;
      } else {
        const value = args[++i];
        if (!value) throw new Error(`missing value for ${key}`);
        (options as Record<string, string>)[key] = value;
      }
    } else if (!target) {
      target = arg;
    } else {
      // positional args - first is often a file path
      if (
        !options.prompt &&
        !options.image &&
        !options.audio &&
        !options.text
      ) {
        // check if it looks like a file
        if (existsSync(arg) || arg.startsWith("./") || arg.startsWith("/")) {
          options.image = arg;
        } else {
          options.prompt = arg;
        }
      } else if (options.image && !options.output) {
        // second positional could be output
        if (
          arg.endsWith(".mp4") ||
          arg.endsWith(".mp3") ||
          arg.endsWith(".png") ||
          arg.endsWith(".srt") ||
          arg.endsWith(".txt")
        ) {
          options.output = arg;
        }
      }
    }
  }

  return { target, options };
}

function showHelp(item: ModelDef | ActionDef) {
  const content: string[] = [];
  content.push("");
  content.push(`  ${item.description}`);
  content.push("");
  content.push(c.bold(c.dim("  USAGE")));
  content.push("");

  if (item.type === "model") {
    const required = item.schema.input.required;
    const reqArgs = required.map((r) => `--${r} <${r}>`).join(" ");
    content.push(`    varg run ${item.name} ${reqArgs} [options]`);
  } else {
    content.push(`    varg run ${item.name} [options]`);
  }

  content.push("");
  content.push(c.bold(c.dim("  OPTIONS")));
  content.push("");

  for (const [key, prop] of Object.entries(item.schema.input.properties)) {
    const required = item.schema.input.required.includes(key);
    const reqTag = required ? c.yellow(" (required)") : "";
    const defaultVal =
      prop.default !== undefined ? c.dim(` default: ${prop.default}`) : "";
    const enumVals = prop.enum ? c.dim(` [${prop.enum.join(", ")}]`) : "";

    content.push(
      `    --${key.padEnd(12)}${
        prop.description
      }${reqTag}${defaultVal}${enumVals}`,
    );
  }

  content.push("");
  content.push(
    `    --output        output file path                      default: ./output.*`,
  );
  content.push(`    --json          output result as json`);
  content.push(`    --quiet         minimal output (just file path)`);
  content.push("");

  if (item.type === "model") {
    content.push(c.bold(c.dim("  EXAMPLES")));
    content.push("");

    if (item.name === "kling") {
      content.push(`    # text to video`);
      content.push(`    varg run kling --prompt "a cat dancing"`);
      content.push("");
      content.push(`    # image to video`);
      content.push(
        `    varg run kling --image ./cat.png --prompt "cat starts dancing"`,
      );
    } else if (item.name === "flux") {
      content.push(`    varg run flux --prompt "cyberpunk cityscape at night"`);
    } else if (item.name === "elevenlabs") {
      content.push(
        `    varg run elevenlabs --text "hello world" --voice rachel`,
      );
    }

    content.push("");
  }

  const titleType = item.type === "action" ? "action" : "model";
  console.log(box(`${titleType}: ${item.name}`, content));
}

function showSchema(item: ModelDef | ActionDef) {
  const schema = {
    name: item.name,
    type: item.type,
    description: item.description,
    input: item.schema.input,
    output: item.schema.output,
  };

  console.log(JSON.stringify(schema, null, 2));
}

async function executeModel(
  model: ModelDef,
  options: RunOptions,
): Promise<string> {
  switch (model.name) {
    case "kling": {
      const provider = options.provider || model.defaultProvider;

      if (options.image) {
        // image to video
        if (provider === "fal") {
          const result = await imageToVideo({
            prompt: options.prompt || "animate this image",
            imageUrl: options.image,
            duration: (options.duration as 5 | 10) || 5,
          });

          const videoUrl = (result.data as { video?: { url?: string } })?.video
            ?.url;
          if (!videoUrl) throw new Error("no video url in result");

          // download and save
          const outputPath = options.output || `./output-${Date.now()}.mp4`;
          const response = await fetch(videoUrl);
          const buffer = Buffer.from(await response.arrayBuffer());
          writeFileSync(outputPath, buffer);

          return outputPath;
        } else {
          // replicate
          const output = await runVideo({
            model: REPLICATE_MODELS.VIDEO.KLING,
            input: {
              prompt: options.prompt || "animate this image",
              image: options.image,
            },
          });

          const videoUrl = Array.isArray(output) ? output[0] : output;
          const outputPath = options.output || `./output-${Date.now()}.mp4`;
          const response = await fetch(videoUrl as string);
          const buffer = Buffer.from(await response.arrayBuffer());
          writeFileSync(outputPath, buffer);

          return outputPath;
        }
      } else {
        // text to video
        const result = await textToVideo({
          prompt: options.prompt || "",
          duration: (options.duration as 5 | 10) || 5,
        });

        const videoUrl = (result.data as { video?: { url?: string } })?.video
          ?.url;
        if (!videoUrl) throw new Error("no video url in result");

        const outputPath = options.output || `./output-${Date.now()}.mp4`;
        const response = await fetch(videoUrl);
        const buffer = Buffer.from(await response.arrayBuffer());
        writeFileSync(outputPath, buffer);

        return outputPath;
      }
    }

    case "flux": {
      const result = await generateImage({
        prompt: options.prompt || "",
        imageSize: options.size || "landscape_4_3",
      });

      const imageUrl = (result.data as { images?: Array<{ url?: string }> })
        ?.images?.[0]?.url;
      if (!imageUrl) throw new Error("no image url in result");

      const outputPath = options.output || `./output-${Date.now()}.png`;
      const response = await fetch(imageUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(outputPath, buffer);

      return outputPath;
    }

    case "wan": {
      if (!options.image || !options.audio) {
        throw new Error("wan requires --image and --audio");
      }

      const result = await wan25({
        imageUrl: options.image,
        audioUrl: options.audio,
        prompt: options.prompt || "person talking",
        duration: (options.duration as "5" | "10") || "5",
        resolution: (options.resolution as "480p" | "720p" | "1080p") || "480p",
      });

      const videoUrl = (result.data as { video?: { url?: string } })?.video
        ?.url;
      if (!videoUrl) throw new Error("no video url in result");

      const outputPath = options.output || `./output-${Date.now()}.mp4`;
      const response = await fetch(videoUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(outputPath, buffer);

      return outputPath;
    }

    case "minimax": {
      const input: Record<string, unknown> = { prompt: options.prompt };
      if (options.image) {
        input.first_frame_image = options.image;
      }

      const output = await runVideo({
        model: REPLICATE_MODELS.VIDEO.MINIMAX,
        input,
      });

      const videoUrl = Array.isArray(output) ? output[0] : output;
      const outputPath = options.output || `./output-${Date.now()}.mp4`;
      const response = await fetch(videoUrl as string);
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(outputPath, buffer);

      return outputPath;
    }

    case "whisper": {
      const result = await transcribe({
        audioUrl: options.audio || options.image || "",
        provider: (options.provider as "groq" | "fireworks") || "groq",
        outputPath: options.output,
      });

      if (!result.success) throw new Error(result.error);
      return result.text || result.srt || "";
    }

    case "elevenlabs": {
      const outputPath = options.output || `./output-${Date.now()}.mp3`;

      await generateVoice({
        text: options.text || options.prompt || "",
        voice: options.voice,
        outputPath,
      });

      return outputPath;
    }

    default:
      throw new Error(`model '${model.name}' execution not implemented`);
  }
}

async function executeAction(
  action: ActionDef,
  options: RunOptions,
): Promise<string> {
  if (!action.routesTo[0]) throw new Error(`action '${action.name}' not found`);

  // find the target model
  const modelName =
    options.model ||
    action.routesTo.find((r) => r.isDefault)?.model ||
    action.routesTo[0].model;

  const model = resolve(modelName);
  if (!model || model.type !== "model") {
    throw new Error(`model '${modelName}' not found`);
  }

  return executeModel(model, options);
}

export async function runCommand(args: string[]) {
  const { target, options } = parseArgs(args);

  if (!target) {
    console.error(`${c.red("error:")} target required`);
    console.log(`\nusage: ${c.cyan("varg run <model|action> [options]")}`);
    console.log(`\nrun ${c.cyan("varg list")} to see available options`);
    process.exit(1);
  }

  const item = resolve(target);

  if (!item) {
    console.error(`${c.red("error:")} '${target}' not found`);
    console.log(
      `\nrun ${c.cyan("varg list")} to see available models and actions`,
    );
    console.log(`or ${c.cyan(`varg find "${target}"`)} to search`);
    process.exit(1);
  }

  // handle --help
  if (options.help) {
    showHelp(item);
    return;
  }

  // handle --schema
  if (options.schema) {
    showSchema(item);
    return;
  }

  // validate required args
  for (const req of item.schema.input.required) {
    const value = (options as Record<string, unknown>)[req];
    if (!value) {
      console.error(`${c.red("error:")} --${req} is required`);
      console.log(`\nrun ${c.cyan(`varg run ${target} --help`)} for usage`);
      process.exit(1);
    }
  }

  // show running state
  const params: Record<string, string> = {};
  if (options.prompt) params.prompt = options.prompt;
  if (options.image) params.image = options.image;
  if (options.audio) params.audio = options.audio;
  if (options.text) params.text = options.text;
  if (options.duration) params.duration = String(options.duration);

  if (!options.quiet && !options.json) {
    console.log(runningBox(target, params, "running"));
  }

  const startTime = Date.now();

  try {
    let result: string;

    if (item.type === "model") {
      result = await executeModel(item, options);
    } else {
      result = await executeAction(item, options);
    }

    const elapsed = Date.now() - startTime;

    if (options.json) {
      console.log(
        JSON.stringify({ success: true, output: result, time: elapsed }),
      );
    } else if (options.quiet) {
      console.log(result);
    } else {
      // clear and show success
      console.log("\x1b[2J\x1b[H"); // clear screen
      console.log(
        runningBox(target, params, "done", {
          output: result,
          time: elapsed,
        }),
      );
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (options.json) {
      console.log(
        JSON.stringify({ success: false, error: errorMsg, time: elapsed }),
      );
    } else if (options.quiet) {
      console.error(errorMsg);
    } else {
      console.log("\x1b[2J\x1b[H");
      console.log(
        runningBox(target, params, "error", {
          error: errorMsg,
          time: elapsed,
        }),
      );
    }

    process.exit(1);
  }
}
