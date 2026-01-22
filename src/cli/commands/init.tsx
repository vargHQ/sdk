import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { defineCommand } from "citty";

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

const HELLO_TEMPLATE = `import { Render, Clip, Image, Video, assets } from "vargai/react";
import { fal } from "vargai/ai";

const girl = Image({
  prompt: {
    text: \`Using the attached reference images, generate a photorealistic three-quarter editorial portrait of the exact same character — maintain identical face, hairstyle, and proportions from Image 1.

Framing: Head and shoulders, cropped at upper chest. Direct eye contact with camera.

Natural confident expression, relaxed shoulders.
Preserve the outfit neckline and visible clothing details from reference.

Background: Deep black with two contrasting orange gradient accents matching Reference 2. Soft gradient bleed, no hard edges.

Shot on 85mm f/1.4 lens, shallow depth of field. Clean studio lighting — soft key light on face, subtle rim light on hair and shoulders for separation. High-end fashion editorial aesthetic.\`,
    images: [assets.characters.orangeGirl, assets.backgrounds.orangeGradient],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

export default (
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Video
        prompt={{
          text: "She waves hello warmly, natural smile, friendly expression. Studio lighting, authentic confident slightly playful atmosphere. Camera static. Intense orange lighting.",
          images: [girl],
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>
  </Render>
);
`;

const SKILL_MD = `---
name: varg-video-generation
description: Generate AI videos using varg SDK React engine. Use when creating videos, animations, talking characters, slideshows, or social media content. Always run onboarding first to check API keys.
license: MIT
metadata:
  author: vargHQ
  version: "1.0.0"
compatibility: Requires bun runtime. FAL_API_KEY required. Optional ELEVENLABS_API_KEY, REPLICATE_API_TOKEN, GROQ_API_KEY
allowed-tools: Bash(bun:*) Bash(cat:*) Read Write Edit
---

# Video Generation with varg React Engine

## Overview

This rule helps you generate AI videos using the varg SDK's React engine. It provides:
- Declarative JSX syntax for video composition
- Automatic caching (same props = instant cache hit)
- Parallel generation where possible
- Support for images, video, music, voice, and captions

## Step 1: Onboarding (REQUIRED for new users)

Before generating videos, ensure the user has the required API keys configured.

### Check Current Setup

Run this command to check existing configuration:

\`\`\`bash
cat .env 2>/dev/null | grep -E "^(FAL_API_KEY|ELEVENLABS_API_KEY|REPLICATE_API_TOKEN|GROQ_API_KEY)=" || echo "No API keys found in .env"
\`\`\`

### Required: FAL_API_KEY

**This is the minimum requirement for video generation.**

| Detail | Value |
|--------|-------|
| Provider | Fal.ai |
| Get it | https://fal.ai/dashboard/keys |
| Free tier | Yes (limited credits) |
| Used for | Image generation (Flux), Video generation (Wan 2.5, Kling) |

If user doesn't have \`FAL_API_KEY\`:
1. Direct them to https://fal.ai/dashboard/keys
2. They need to create an account and generate an API key
3. Add to \`.env\` file in project root

### Optional Keys (warn if missing, but continue)

| Feature | Required Key | Provider | Get It |
|---------|-------------|----------|--------|
| Music generation | \`ELEVENLABS_API_KEY\` | ElevenLabs | https://elevenlabs.io/app/settings/api-keys |
| Voice/Speech | \`ELEVENLABS_API_KEY\` | ElevenLabs | https://elevenlabs.io/app/settings/api-keys |
| Lipsync | \`REPLICATE_API_TOKEN\` | Replicate | https://replicate.com/account/api-tokens |
| Transcription | \`GROQ_API_KEY\` | Groq | https://console.groq.com/keys |

**When keys are missing, inform user what features are unavailable.**

## Step 2: Running Videos

\`\`\`bash
bunx vargai render video.tsx
\`\`\`

## Key Components

| Component | Purpose | Required Key |
|-----------|---------|--------------|
| \`<Render>\` | Root container | - |
| \`<Clip>\` | Sequential segment | - |
| \`<Image>\` | AI image | FAL |
| \`<Video>\` | AI video | FAL |
| \`<Music>\` | Background music | ElevenLabs |
| \`<Speech>\` | Text-to-speech | ElevenLabs |

## Common Patterns

### Character Consistency
\`\`\`tsx
const character = Image({ prompt: "blue robot" });
// Reuse same reference for consistent appearance
<Video prompt={{ text: "waving", images: [character] }} />
<Video prompt={{ text: "dancing", images: [character] }} />
\`\`\`

### Transitions
\`\`\`tsx
<Clip transition={{ name: "fade", duration: 0.5 }}>
// Options: fade, crossfade, wipeleft, cube, slideup, etc.
\`\`\`

### Aspect Ratios
- \`9:16\` - TikTok, Reels, Shorts (vertical)
- \`16:9\` - YouTube (horizontal)
- \`1:1\` - Instagram (square)
`;

const ENV_TEMPLATE = `# Varg AI Video Generation - API Keys

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

export function showInitHelp() {
  console.log(`
${COLORS.bold}vargai init${COLORS.reset}

initialize a new varg project with api key setup and hello.tsx template.

${COLORS.bold}USAGE${COLORS.reset}
  vargai init [directory]

${COLORS.bold}EXAMPLES${COLORS.reset}
  ${COLORS.cyan}vargai init${COLORS.reset}              setup in current directory
  ${COLORS.cyan}vargai init my-project${COLORS.reset}  setup in my-project/
`);
}

export const initCmd = defineCommand({
  meta: {
    name: "init",
    description: "setup project with api keys and hello.tsx",
  },
  args: {
    directory: {
      type: "positional",
      description: "project directory (default: current)",
      required: false,
    },
  },
  async run({ args }) {
    const dir = (args.directory as string) || ".";
    const cwd = dir === "." ? process.cwd() : join(process.cwd(), dir);

    console.log(`
${COLORS.bold}${COLORS.cyan}
 ██╗   ██╗ █████╗ ██████╗  ██████╗ 
 ██║   ██║██╔══██╗██╔══██╗██╔════╝ 
 ██║   ██║███████║██████╔╝██║  ███╗
 ╚██╗ ██╔╝██╔══██║██╔══██╗██║   ██║
  ╚████╔╝ ██║  ██║██║  ██║╚██████╔╝
   ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ 
${COLORS.reset}
${COLORS.bold}AI Video Generation Setup${COLORS.reset}
`);

    // Step 1: Create directory structure
    log.step("Setting up project structure");

    if (!existsSync(cwd) && dir !== ".") {
      mkdirSync(cwd, { recursive: true });
      log.success(`Created ${dir}/`);
    }

    const dirs = ["output", ".cache/ai"];
    for (const d of dirs) {
      const path = join(cwd, d);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
        log.success(`Created ${d}/`);
      } else {
        log.info(`${d}/ already exists`);
      }
    }

    // Step 2: Check/create .env and prompt for FAL_API_KEY
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

      const hasElevenLabs = /^ELEVENLABS_API_KEY=.+/m.test(envContent);
      const hasReplicate = /^REPLICATE_API_TOKEN=.+/m.test(envContent);
      const hasGroq = /^GROQ_API_KEY=.+/m.test(envContent);

      if (hasElevenLabs)
        log.info("ELEVENLABS_API_KEY found (music/voice enabled)");
      if (hasReplicate) log.info("REPLICATE_API_TOKEN found (lipsync enabled)");
      if (hasGroq) log.info("GROQ_API_KEY found (transcription enabled)");
    } else {
      log.warn(".env file not found");
    }

    if (!hasFalKey) {
      console.log(`
${COLORS.yellow}FAL_API_KEY is required for video generation.${COLORS.reset}

Get your free API key at: ${COLORS.cyan}https://fal.ai/dashboard/keys${COLORS.reset}
`);

      process.stdout.write("Enter your FAL_API_KEY (or press Enter to skip): ");

      const falKey = await new Promise<string>((resolve) => {
        process.stdin.setEncoding("utf8");
        process.stdin.once("data", (data) => {
          resolve(data.toString().trim());
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

    // Step 3: Install Agent Skills
    log.step("Installing Agent Skills");

    const skillsDir = join(cwd, ".claude/skills/varg-video-generation");
    const skillPath = join(skillsDir, "SKILL.md");

    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
    }

    writeFileSync(skillPath, SKILL_MD);
    log.success("Installed SKILL.md (Agent Skills format)");

    const rulesDir = join(cwd, ".claude/rules");
    const rulePath = join(rulesDir, "video-generation.md");

    if (!existsSync(rulesDir)) {
      mkdirSync(rulesDir, { recursive: true });
    }

    if (existsSync(rulePath)) {
      unlinkSync(rulePath);
    }

    symlinkSync("../skills/varg-video-generation/SKILL.md", rulePath);
    log.success("Created Claude Code rules symlink");

    // Step 4: Create hello.tsx
    log.step("Creating hello.tsx");

    const helloPath = join(cwd, "hello.tsx");
    if (!existsSync(helloPath)) {
      writeFileSync(helloPath, HELLO_TEMPLATE);
      log.success("Created hello.tsx");
    } else {
      log.info("hello.tsx already exists");
    }

    // Step 5: Update .gitignore
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

${COLORS.bold}What was installed:${COLORS.reset}
  ${COLORS.dim}├─${COLORS.reset} hello.tsx ${COLORS.dim}(starter video)${COLORS.reset}
  ${COLORS.dim}├─${COLORS.reset} .claude/skills/varg-video-generation/SKILL.md ${COLORS.dim}(Agent Skills)${COLORS.reset}
  ${COLORS.dim}├─${COLORS.reset} output/ ${COLORS.dim}(video output folder)${COLORS.reset}
  ${COLORS.dim}└─${COLORS.reset} .cache/ai/ ${COLORS.dim}(generation cache)${COLORS.reset}

${COLORS.bold}Next steps:${COLORS.reset}
`);

    if (!hasFalKey) {
      console.log(`  ${COLORS.yellow}1. Add FAL_API_KEY to .env${COLORS.reset}
     Get it at: https://fal.ai/dashboard/keys
`);
    }

    console.log(`  ${hasFalKey ? "1" : "2"}. Render your first video:
     ${COLORS.cyan}bunx vargai render hello.tsx${COLORS.reset}

  ${hasFalKey ? "2" : "3"}. Or ask Claude to create a video:
     ${COLORS.cyan}claude "create a 10 second tiktok video about cats"${COLORS.reset}

${COLORS.dim}Documentation: https://github.com/vargHQ/sdk${COLORS.reset}
`);
  },
});
