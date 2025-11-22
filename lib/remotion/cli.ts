import {
  createComposition,
  getCompositionsList,
  render,
  renderStill,
} from "./functions";

// cli
export async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    console.log(`
usage:
  bun run lib/remotion.ts <command> [args]

commands:
  create <name>                                        setup composition directory
  compositions <root-file.tsx>                         list all compositions
  render <root-file.tsx> <comp-id> <output.mp4>       render video
  still <root-file.tsx> <comp-id> <frame> <out.png>   render still frame
  help                                                 show this help

examples:
  bun run lib/remotion/index.ts create MyVideo
  bun run lib/remotion/index.ts compositions lib/remotion/compositions/MyVideo.root.tsx
  bun run lib/remotion/index.ts render lib/remotion/compositions/MyVideo.root.tsx Demo output.mp4
  bun run lib/remotion/index.ts still lib/remotion/compositions/MyVideo.root.tsx Demo 30 frame.png

requirements:
  remotion and @remotion/cli must be installed
  bun install remotion @remotion/cli
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "create": {
        const name = args[1];

        if (!name) {
          throw new Error("composition name is required");
        }

        await createComposition({ name });
        console.log("\ncomposition setup complete!");
        break;
      }

      case "compositions": {
        const entryPoint = args[1];

        if (!entryPoint) {
          throw new Error("entry point is required");
        }

        const compositions = await getCompositionsList(entryPoint);

        console.log("\navailable compositions:");
        for (const comp of compositions) {
          console.log(
            `  ${comp.id}: ${comp.width}x${comp.height} @ ${comp.fps}fps (${comp.durationInFrames} frames)`,
          );
        }
        break;
      }

      case "render": {
        const entryPoint = args[1];
        const compositionId = args[2];
        const outputPath = args[3];

        if (!entryPoint || !compositionId || !outputPath) {
          throw new Error(
            "entryPoint, compositionId, and outputPath are required",
          );
        }

        await render({ entryPoint, compositionId, outputPath });
        break;
      }

      case "still": {
        const entryPoint = args[1];
        const compositionId = args[2];
        const frameArg = args[3];
        const outputPath = args[4];

        if (!entryPoint || !compositionId || !frameArg || !outputPath) {
          throw new Error(
            "entryPoint, compositionId, frame, and outputPath are required",
          );
        }

        const frame = Number.parseInt(frameArg, 10);
        if (Number.isNaN(frame)) {
          throw new Error("frame must be a valid number");
        }

        await renderStill(entryPoint, compositionId, frame, outputPath);
        break;
      }

      default:
        console.error(`unknown command: ${command}`);
        console.log("run 'bun run lib/remotion.ts help' for usage");
        process.exit(1);
    }
  } catch (error) {
    console.error("[remotion] error:", error);
    process.exit(1);
  }
}
