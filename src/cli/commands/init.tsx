/**
 * vargai init — one-stop project setup
 *
 * Flow:
 * 1. Check credentials → run login if needed (dual-mode: email or API key)
 * 2. Optionally show credit package selector
 * 3. Create project structure (output/, .cache/ai/)
 * 4. Install varg-ai Agent Skill via `npx skills add vargHQ/skills`
 * 5. Update .gitignore
 * 6. Print next steps (Claude-first messaging)
 * 7. Ask to star the repo on GitHub (via gh CLI, if available)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "citty";
import { getCredentials, getGlobalApiKey } from "../credentials";
import { COLORS, log, readLine, runLogin } from "./login.tsx";

// ──── GitHub Star Prompt ────

async function maybeAskForStar(): Promise<void> {
  try {
    // Check if gh CLI is available and authenticated
    const authCheck = Bun.spawn(["gh", "auth", "status"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const authExit = await authCheck.exited;
    if (authExit !== 0) return;

    // Check if already starred (204 = starred, 404 = not starred)
    const starCheck = Bun.spawn(["gh", "api", "user/starred/vargHQ/sdk"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const starExit = await starCheck.exited;

    if (starExit === 0) {
      // Already starred — skip silently
      return;
    }

    // Ask user (default: yes)
    console.log();
    const answer = await readLine(
      `  ${COLORS.dim}Star varg on GitHub to help us grow?${COLORS.reset} (Y/n): `,
    );

    if (answer.toLowerCase() === "n") return;

    const star = Bun.spawn(
      ["gh", "api", "-X", "PUT", "user/starred/vargHQ/sdk"],
      { stdout: "pipe", stderr: "pipe" },
    );
    const starResult = await star.exited;

    if (starResult === 0) {
      log.success("Starred vargHQ/sdk on GitHub — thanks!");
    }
  } catch {
    // gh not available or any error — skip silently
  }
}

export function showInitHelp() {
  console.log(`
${COLORS.bold}vargai init${COLORS.reset}

initialize a new varg project — handles authentication, skills, and project setup.

${COLORS.bold}USAGE${COLORS.reset}
  vargai init [directory]

${COLORS.bold}EXAMPLES${COLORS.reset}
  ${COLORS.cyan}vargai init${COLORS.reset}              setup in current directory
  ${COLORS.cyan}vargai init my-project${COLORS.reset}   setup in my-project/

${COLORS.bold}WHAT IT DOES${COLORS.reset}
  1. Signs you in (email or API key) if not already authenticated
  2. Offers credit packages for purchase
  3. Creates project structure (output/, .cache/ai/)
  4. Installs varg-ai Agent Skill (10 reference docs, setup scripts)
`);
}

export const initCmd = defineCommand({
  meta: {
    name: "init",
    description: "setup project with authentication and skills",
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

    // ──── Step 1: Authentication ────

    const existingKey = process.env.VARG_API_KEY ?? getGlobalApiKey();
    const existingCreds = getCredentials();
    let hasVargCredentials = !!existingKey;

    if (existingKey && existingCreds) {
      const label = existingCreds.email
        ? existingCreds.email
        : `API key: ${existingKey.slice(0, 12)}...`;
      log.step("Authentication");
      log.success(`Signed in as ${COLORS.bold}${label}${COLORS.reset}`);
    } else if (existingKey) {
      log.step("Authentication");
      log.success(
        `Using API key from ${COLORS.dim}VARG_API_KEY${COLORS.reset} environment variable`,
      );
    } else {
      const loginResult = await runLogin({
        showPackages: true,
        showHeader: false,
        forceLogin: false,
      });

      if (loginResult) {
        hasVargCredentials = true;
      }
      if (!loginResult) {
        hasVargCredentials = !!getGlobalApiKey();
      }
    }

    // ──── Step 2: Create directory structure ────

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

    // ──── Step 3: Install Agent Skill ────

    log.step("Installing varg-ai Agent Skill");

    const skillCheck = join(cwd, ".claude/skills/varg-ai/SKILL.md");
    const hasSkillAlready = existsSync(skillCheck);

    if (hasSkillAlready) {
      log.info("varg-ai skill already installed");
    } else {
      process.stdout.write(
        `${COLORS.dim}  ● Installing via npx skills add...${COLORS.reset}`,
      );

      try {
        const proc = Bun.spawn(
          [
            "npx",
            "-y",
            "skills",
            "add",
            "vargHQ/skills",
            "--all",
            "--copy",
            "-y",
          ],
          {
            cwd,
            stdout: "pipe",
            stderr: "pipe",
          },
        );

        const exitCode = await proc.exited;

        process.stdout.write("\r\x1b[K");

        if (exitCode === 0) {
          log.success(
            "Installed varg-ai skill (SKILL.md + 10 reference docs + setup scripts)",
          );
        } else {
          const stderr = await new Response(proc.stderr).text();
          log.warn(`Skills installer exited with code ${exitCode}`);
          if (stderr.trim()) {
            console.log(`${COLORS.dim}  ${stderr.trim()}${COLORS.reset}`);
          }
          console.log();
          log.info(
            `You can install manually: ${COLORS.cyan}npx skills add vargHQ/skills${COLORS.reset}`,
          );
        }
      } catch (err) {
        process.stdout.write("\r\x1b[K");
        log.warn("Could not run skills installer automatically.");
        log.info(
          `Install manually: ${COLORS.cyan}npx skills add vargHQ/skills${COLORS.reset}`,
        );
      }
    }

    // ──── Step 4: Update .gitignore ────

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
      writeFileSync(gitignorePath, `${gitignoreContent.trim()}\n`);
      log.success("Updated .gitignore");
    } else {
      log.info(".gitignore already configured");
    }

    // ──── Summary ────

    console.log(`
${COLORS.green}${COLORS.bold}Setup complete!${COLORS.reset}

${COLORS.bold}What was installed:${COLORS.reset}
  ${COLORS.dim}├─${COLORS.reset} .claude/skills/varg-ai/ ${COLORS.dim}(Agent Skill v2 + references)${COLORS.reset}
  ${COLORS.dim}├─${COLORS.reset} output/ ${COLORS.dim}(video output folder)${COLORS.reset}
  ${COLORS.dim}└─${COLORS.reset} .cache/ai/ ${COLORS.dim}(generation cache)${COLORS.reset}

${COLORS.bold}Next steps:${COLORS.reset}

  ${COLORS.bold}1.${COLORS.reset} Ask Claude to create a video:
     ${COLORS.cyan}claude "create a 10-second product video for white sneakers, 9:16, UGC style, with captions and background music"${COLORS.reset}

  ${COLORS.bold}2.${COLORS.reset} Or make one from this terminal:
     ${COLORS.cyan}bunx vargai mcp generate_video --prompt "waves at dusk" --duration 5${COLORS.reset}
`);

    if (!hasVargCredentials) {
      console.log(
        `  ${COLORS.yellow}Note: Run ${COLORS.cyan}vargai login${COLORS.reset}${COLORS.yellow} to authenticate before generating.${COLORS.reset}`,
      );
      console.log();
    }

    // ──── Step 5: GitHub Star ────

    await maybeAskForStar();

    console.log();
    console.log(
      `${COLORS.dim}Documentation: https://docs.varg.ai${COLORS.reset}`,
    );
    console.log();
  },
});
