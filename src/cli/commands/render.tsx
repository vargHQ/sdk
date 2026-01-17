import { defineCommand } from "citty";
import { render } from "../../ai-sdk/react/render";
import type { VargElement } from "../../ai-sdk/react/types";

export const renderCmd = defineCommand({
  meta: {
    name: "render",
    description: "render a react component to video",
  },
  args: {
    file: {
      type: "positional",
      description: "component file (.tsx)",
      required: true,
    },
    output: {
      type: "string",
      alias: "o",
      description: "output path",
    },
    cache: {
      type: "string",
      alias: "c",
      description: "cache directory",
      default: ".cache/ai",
    },
    quiet: {
      type: "boolean",
      alias: "q",
      description: "minimal output",
      default: false,
    },
  },
  async run({ args }) {
    const file = args.file as string;

    if (!file) {
      console.error("usage: varg render <component.tsx> [-o output.mp4]");
      process.exit(1);
    }

    const resolvedPath = Bun.resolveSync(file, process.cwd());
    const mod = await import(resolvedPath);
    const component: VargElement = mod.default;

    if (!component || component.type !== "render") {
      console.error("error: default export must be a <Render> element");
      process.exit(1);
    }

    const outputPath =
      args.output ??
      `output/${file
        .replace(/\.tsx?$/, "")
        .split("/")
        .pop()}.mp4`;

    if (!args.quiet) {
      console.log(`rendering ${file} → ${outputPath}`);
    }

    const buffer = await render(component, {
      output: outputPath,
      cache: args.cache,
    });

    if (!args.quiet) {
      console.log(`done! ${buffer.byteLength} bytes → ${outputPath}`);
    }
  },
});
