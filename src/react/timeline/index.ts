import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { VargElement } from "../types";
import { exportFCPXML } from "./fcpxml";
import { exportOTIO } from "./otio";
import type { TimelineExportOptions, TimelineExportResult } from "./types";
import { walkTree } from "./walker";

export type {
  ExportMode,
  Timeline,
  TimelineExportOptions,
  TimelineExportResult,
  TimelineFormat,
} from "./types";

export async function exportTimeline(
  element: VargElement<"render">,
  options: TimelineExportOptions,
): Promise<TimelineExportResult> {
  const cacheDir = options.cache ?? ".cache/timeline";
  await mkdir(cacheDir, { recursive: true });

  const outputDir = dirname(resolve(options.output));
  await mkdir(outputDir, { recursive: true });

  if (!options.quiet) {
    console.log(`extracting timeline (${options.mode} mode)...`);
  }

  const timeline = await walkTree(element, options.mode, cacheDir);
  timeline.metadata.sourceFile = options.output;

  let content: string;
  if (options.format === "otio") {
    content = exportOTIO(timeline);
  } else {
    content = exportFCPXML(timeline);
  }

  const outputPath = resolve(options.output);
  await Bun.write(outputPath, content);

  if (!options.quiet) {
    console.log(`exported ${options.format} → ${outputPath}`);
  }

  const placeholderCount = timeline.assets.filter(
    (a) => a.isPlaceholder,
  ).length;

  return {
    timelinePath: outputPath,
    format: options.format,
    assets: timeline.assets,
    summary: {
      clips: timeline.videoTracks.reduce((sum, t) => sum + t.items.length, 0),
      audioTracks: timeline.audioTracks.length,
      transitions: timeline.transitions.length,
      placeholders: placeholderCount,
      duration: timeline.duration,
    },
  };
}
