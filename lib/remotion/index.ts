#!/usr/bin/env bun

/**
 * remotion wrapper for programmatic video creation
 * requires @remotion/cli and remotion packages
 *
 * usage: bun run lib/remotion/index.ts <command> <args>
 *
 * simplified workflow:
 * 1. create composition with: bun run lib/remotion/index.ts create <name>
 * 2. copy media files to lib/remotion/public/
 * 3. customize composition files (use staticFile() for media paths)
 * 4. render with: bun run lib/remotion/index.ts render <root.tsx> <id> <output.mp4>
 */
import { cli } from "./cli";

if (import.meta.main) {
  cli();
}
