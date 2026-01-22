#!/usr/bin/env bun
/**
 * varg-video-generation setup script
 *
 * This script initializes a project for AI video generation.
 * Can be run standalone by agents or via bunx vargai.
 *
 * Usage:
 *   bun scripts/setup.ts
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg: string) =>
    console.log(`${COLORS.blue}info${COLORS.reset} ${msg}`),
  success: (msg: string) =>
    console.log(`${COLORS.green}done${COLORS.reset} ${msg}`),
  warn: (msg: string) =>
    console.log(`${COLORS.yellow}warn${COLORS.reset} ${msg}`),
  error: (msg: string) =>
    console.log(`${COLORS.red}error${COLORS.reset} ${msg}`),
  step: (msg: string) =>
    console.log(
      `\n${COLORS.bold}${COLORS.cyan}==>${COLORS.reset} ${COLORS.bold}${msg}${COLORS.reset}`,
    ),
};

// .env template
const ENV_TEMPLATE = `# Varg AI Video Generation - API Keys
# Get your keys from the URLs below

# REQUIRED - Fal.ai (image & video generation)
# Get it: https://fal.ai/dashboard/keys
FAL_API_KEY=

# OPTIONAL - ElevenLabs (music & voice)
# Get it: https://elevenlabs.io/app/settings/api-keys
ELEVENLABS_API_KEY=

# OPTIONAL - Replicate (lipsync)
# Get it: https://replicate.com/account/api-tokens
REPLICATE_API_TOKEN=

# OPTIONAL - Groq (transcription)
# Get it: https://console.groq.com/keys
GROQ_API_KEY=
`;

// Example video file
const EXAMPLE_VIDEO = `/**
 * Example: Simple animated video
 * Run: bun run examples/my-first-video.tsx
 */
import { render, Render, Clip, Image, Animate } from "vargai/react";
import { fal } from "vargai/ai";

async function main() {
  console.log("Creating your first AI video...\\n");

  await render(
    <Render width={720} height={720}>
      <Clip duration={3}>
        <Animate
          image={Image({
            prompt: "a friendly robot waving hello, cartoon style, blue colors",
            model: fal.imageModel("flux-schnell"),
            aspectRatio: "1:1",
          })}
          motion="robot waves hello, friendly gesture"
          model={fal.videoModel("wan-2.5")}
          duration={3}
        />
      </Clip>
    </Render>,
    { 
      output: "output/my-first-video.mp4",
      cache: ".cache/ai"
    }
  );

  console.log("\\nDone! Check output/my-first-video.mp4");
}

main().catch(console.error);
`;

async function main() {
  console.log(`
${COLORS.bold}${COLORS.cyan}varg-video-generation${COLORS.reset} ${COLORS.dim}setup${COLORS.reset}
`);

  const cwd = process.cwd();

  // Step 1: Check/create directories
  log.step("Setting up project structure");

  const dirs = ["output", ".cache/ai", "examples"];
  for (const dir of dirs) {
    const path = join(cwd, dir);
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
      log.success(`Created ${dir}/`);
    } else {
      log.info(`${dir}/ already exists`);
    }
  }

  // Step 2: Check/create .env
  log.step("Checking API keys");

  const envPath = join(cwd, ".env");
  let envContent = "";
  let hasFalKey = false;

  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, "utf8");
    hasFalKey = /^FAL_API_KEY=.+/m.test(envContent);

    if (hasFalKey) {
      log.success("FAL_API_KEY found in .env");
    } else {
      log.warn("FAL_API_KEY not found in .env");
    }

    // Check optional keys
    const hasElevenLabs = /^ELEVENLABS_API_KEY=.+/m.test(envContent);
    const hasReplicate = /^REPLICATE_API_TOKEN=.+/m.test(envContent);
    const hasGroq = /^GROQ_API_KEY=.+/m.test(envContent);

    if (hasElevenLabs)
      log.info("ELEVENLABS_API_KEY found (music/voice enabled)");
    if (hasReplicate) log.info("REPLICATE_API_TOKEN found (lipsync enabled)");
    if (hasGroq) log.info("GROQ_API_KEY found (transcription enabled)");

    if (!hasElevenLabs && !hasReplicate && !hasGroq) {
      log.info("No optional keys found (basic video generation only)");
    }
  } else {
    log.warn(".env file not found");
  }

  // If no FAL key, prompt for it
  if (!hasFalKey) {
    console.log(`
${COLORS.yellow}FAL_API_KEY is required for video generation.${COLORS.reset}

Get your free API key at: ${COLORS.cyan}https://fal.ai/dashboard/keys${COLORS.reset}
`);

    process.stdout.write("Enter your FAL_API_KEY (or press Enter to skip): ");

    const falKey = await new Promise<string>((resolve) => {
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", (data) => {
        input = data.toString().trim();
        resolve(input);
      });
    });

    if (falKey) {
      if (existsSync(envPath)) {
        const newEnvContent = envContent.includes("FAL_API_KEY")
          ? envContent.replace(/^FAL_API_KEY=.*/m, `FAL_API_KEY=${falKey}`)
          : `${envContent}\nFAL_API_KEY=${falKey}`;
        writeFileSync(envPath, newEnvContent);
      } else {
        writeFileSync(
          envPath,
          ENV_TEMPLATE.replace("FAL_API_KEY=", `FAL_API_KEY=${falKey}`),
        );
      }
      log.success("FAL_API_KEY saved to .env");
      hasFalKey = true;
    } else {
      if (!existsSync(envPath)) {
        writeFileSync(envPath, ENV_TEMPLATE);
        log.info("Created .env template - add your keys manually");
      }
    }
  }

  // Step 3: Create example file
  log.step("Creating example files");

  const examplePath = join(cwd, "examples/my-first-video.tsx");
  if (!existsSync(examplePath)) {
    writeFileSync(examplePath, EXAMPLE_VIDEO);
    log.success("Created examples/my-first-video.tsx");
  } else {
    log.info("examples/my-first-video.tsx already exists");
  }

  // Step 4: Add to .gitignore
  log.step("Updating .gitignore");

  const gitignorePath = join(cwd, ".gitignore");
  const gitignoreEntries = [".env", ".cache/", "output/"];
  let gitignoreContent = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf8")
    : "";

  let added = false;
  for (const entry of gitignoreEntries) {
    if (!gitignoreContent.includes(entry)) {
      gitignoreContent += `\n${entry}`;
      added = true;
    }
  }

  if (added) {
    writeFileSync(gitignorePath, gitignoreContent.trim() + "\n");
    log.success("Updated .gitignore");
  } else {
    log.info(".gitignore already configured");
  }

  // Summary
  console.log(`
${COLORS.green}${COLORS.bold}Setup complete!${COLORS.reset}

${COLORS.bold}Next steps:${COLORS.reset}
`);

  if (!hasFalKey) {
    console.log(`  ${COLORS.yellow}1. Add FAL_API_KEY to .env${COLORS.reset}
     Get it at: https://fal.ai/dashboard/keys
`);
  }

  console.log(`  ${hasFalKey ? "1" : "2"}. Install vargai package:
     ${COLORS.cyan}bun add vargai${COLORS.reset}

  ${hasFalKey ? "2" : "3"}. Run your first video:
     ${COLORS.cyan}bun run examples/my-first-video.tsx${COLORS.reset}

${COLORS.dim}Documentation: https://github.com/vargHQ/sdk${COLORS.reset}
`);

  process.exit(0);
}

main().catch((error) => {
  log.error(error.message);
  process.exit(1);
});
