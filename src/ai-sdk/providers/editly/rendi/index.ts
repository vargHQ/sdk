import sharp from "sharp";
import { File } from "../../../file";
import type { StorageProvider } from "../../../storage/types";
import type {
  FFmpegBackend,
  FFmpegInput,
  FFmpegRunOptions,
  FFmpegRunResult,
  FilePath,
  VideoInfo,
} from "../backends/types";

const RENDI_API_BASE = "https://api.rendi.dev/v1";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 300;
const DEFAULT_MAX_COMMAND_SECONDS = 60;

interface RendiCommandResponse {
  command_id: string;
}

interface RendiStoredFile {
  file_id: string;
  storage_url: string | null;
  status: string;
  duration?: number;
  width?: number;
  height?: number;
  frame_rate?: number;
}

interface RendiStatusResponse {
  command_id: string;
  status: "QUEUED" | "PROCESSING" | "SUCCESS" | "FAILED";
  error_message?: string;
  output_files?: Record<string, RendiStoredFile>;
}

export interface RendiBackendOptions {
  apiKey?: string;
  storage: StorageProvider;
}

export class RendiBackend implements FFmpegBackend {
  readonly name = "rendi";
  private apiKey: string;
  private storage: StorageProvider;

  constructor(options: RendiBackendOptions) {
    this.apiKey = options.apiKey ?? process.env.RENDI_API_KEY ?? "";
    this.storage = options.storage;
    if (!this.apiKey) {
      throw new Error("RENDI_API_KEY is required for Rendi backend");
    }
  }

  async ffprobe(input: string): Promise<VideoInfo> {
    const inputUrl = await this.resolvePath(input);

    const submitResponse = await fetch(`${RENDI_API_BASE}/run-ffmpeg-command`, {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input_files: { in_1: inputUrl },
        output_files: { out_1: "probe.mp4" },
        ffmpeg_command: "-i {{in_1}} -c copy {{out_1}}",
        max_command_run_seconds: DEFAULT_MAX_COMMAND_SECONDS,
      }),
    });

    if (!submitResponse.ok) {
      throw new Error(`Rendi ffprobe failed: ${submitResponse.status}`);
    }

    const { command_id } =
      (await submitResponse.json()) as RendiCommandResponse;

    let attempts = 0;
    while (attempts < MAX_POLL_ATTEMPTS) {
      const statusResponse = await fetch(
        `${RENDI_API_BASE}/commands/${command_id}`,
        { headers: { "X-API-KEY": this.apiKey } },
      );

      if (!statusResponse.ok) {
        throw new Error(`Rendi ffprobe poll failed: ${statusResponse.status}`);
      }

      const status = (await statusResponse.json()) as RendiStatusResponse;

      if (status.status === "SUCCESS") {
        const output = status.output_files?.out_1;
        if (!output) {
          throw new Error("rendi ffprobe completed but no output metadata");
        }
        return {
          duration: output.duration ?? 0,
          width: output.width,
          height: output.height,
          fps: output.frame_rate,
        };
      }

      if (status.status === "FAILED") {
        throw new Error(`Rendi ffprobe failed: ${status.error_message}`);
      }

      await this.sleep(POLL_INTERVAL_MS);
      attempts++;
    }

    throw new Error("Rendi ffprobe timed out");
  }

  private getInputPath(input: FFmpegInput): FilePath {
    if (input instanceof File) return input;
    if (typeof input === "string") return input;
    if ("raw" in input) throw new Error("raw inputs not supported in Rendi");
    return input.path;
  }

  async run(options: FFmpegRunOptions): Promise<FFmpegRunResult> {
    let {
      inputs,
      filterComplex,
      videoFilter,
      outputArgs = [],
      outputPath,
      verbose,
    } = options;

    // Synthetic-only commands (e.g. fill-color, gradient clips) produce a
    // filterComplex that uses lavfi sources like `color=...` with zero file
    // inputs.  Rendi requires at least one input_file, so we upload a tiny
    // 1×1 transparent PNG as a dummy input that ffmpeg silently ignores
    // (the filterComplex never references [0:v]).
    if (!inputs || inputs.length === 0) {
      if (!filterComplex) {
        throw new Error(
          "Rendi backend requires at least one input file or a filterComplex with synthetic sources.",
        );
      }
      const dummyUrl = await this.getOrCreateDummyInput();
      inputs = [dummyUrl];
    }

    const inputFiles: Record<string, string> = {};
    const pathToPlaceholder = new Map<string, string>();

    for (const [i, input] of inputs.entries()) {
      const path = this.getInputPath(input);
      const url = await this.resolvePath(path);
      const placeholder = `in_${i + 1}`;
      inputFiles[placeholder] = url;
      pathToPlaceholder.set(url, `{{${placeholder}}}`);
    }

    const replaceWithPlaceholders = (str: string): string => {
      let result = str;
      const sortedEntries = [...pathToPlaceholder.entries()].sort(
        (a, b) => b[0].length - a[0].length,
      );
      for (const [url, ph] of sortedEntries) {
        if (result.includes(url)) {
          result = result.replaceAll(url, ph);
        }
      }
      return result;
    };

    const inputArgs: string[] = [];
    for (const [i, input] of inputs.entries()) {
      if (typeof input !== "string" && "options" in input && input.options) {
        inputArgs.push(...input.options);
      }
      inputArgs.push("-i", `{{in_${i + 1}}}`);
    }

    const filterArgs: string[] = [];
    if (filterComplex) {
      filterArgs.push(
        "-filter_complex",
        replaceWithPlaceholders(filterComplex),
      );
    }
    if (videoFilter) {
      filterArgs.push("-vf", replaceWithPlaceholders(videoFilter));
    }

    const processedOutputArgs = outputArgs
      .filter((arg) => arg !== "-y")
      .map((arg) => replaceWithPlaceholders(arg));

    const commandParts = [
      ...inputArgs,
      ...filterArgs,
      ...processedOutputArgs,
      "{{out_1}}",
    ];
    const ffmpegCommand = this.buildCommandString(commandParts);
    const outputFilename = outputPath?.split("/").pop() ?? "output.mp4";

    if (verbose) {
      console.log("[rendi] input_files:", inputFiles);
      console.log("[rendi] ffmpeg_command:", ffmpegCommand);
    }

    const submitResponse = await fetch(`${RENDI_API_BASE}/run-ffmpeg-command`, {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input_files: inputFiles,
        output_files: { out_1: outputFilename },
        ffmpeg_command: ffmpegCommand,
        max_command_run_seconds: DEFAULT_MAX_COMMAND_SECONDS,
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(
        `Rendi submit failed: ${submitResponse.status} - ${errorText}`,
      );
    }

    const { command_id } =
      (await submitResponse.json()) as RendiCommandResponse;

    if (verbose) {
      console.log("[rendi] command_id:", command_id);
    }

    let attempts = 0;
    while (attempts < MAX_POLL_ATTEMPTS) {
      const statusResponse = await fetch(
        `${RENDI_API_BASE}/commands/${command_id}`,
        {
          headers: { "X-API-KEY": this.apiKey },
        },
      );

      if (!statusResponse.ok) {
        throw new Error(`Rendi poll failed: ${statusResponse.status}`);
      }

      const status = (await statusResponse.json()) as RendiStatusResponse;

      if (verbose && attempts % 5 === 0) {
        console.log("[rendi] status:", status.status);
      }

      if (status.status === "SUCCESS") {
        const outputFile = status.output_files?.out_1;
        if (!outputFile?.storage_url) {
          throw new Error("Rendi completed but no output URL found");
        }

        if (verbose) {
          console.log("[rendi] output url:", outputFile.storage_url);
        }

        return { output: { type: "url", url: outputFile.storage_url } };
      }

      if (status.status === "FAILED") {
        throw new Error(
          `Rendi command failed: ${status.error_message ?? "Unknown error"}`,
        );
      }

      await this.sleep(POLL_INTERVAL_MS);
      attempts++;
    }

    throw new Error("Rendi command timed out");
  }

  async resolvePath(input: FilePath): Promise<string> {
    if (input instanceof File) {
      return input.upload(this.storage);
    }
    if (input.startsWith("http://") || input.startsWith("https://")) {
      return input;
    }
    const file = File.fromPath(input);
    return file.upload(this.storage);
  }

  /** Cached URL of the 1×1 dummy PNG so we upload it at most once per backend instance. */
  private dummyInputUrl: string | null = null;

  /**
   * Generate a 1×1 transparent PNG via sharp, upload it to storage, and cache
   * the URL.  Used as a placeholder input for Rendi when the ffmpeg command
   * has only synthetic (lavfi) sources and no real file inputs.
   */
  private async getOrCreateDummyInput(): Promise<string> {
    if (this.dummyInputUrl) return this.dummyInputUrl;
    const png = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    const key = "internal/rendi-dummy-1x1.png";
    this.dummyInputUrl = await this.storage.upload(png, key, "image/png");
    return this.dummyInputUrl;
  }

  private buildCommandString(args: string[]): string {
    return args
      .map((arg) => {
        if (arg.startsWith("-") || arg.startsWith("{{")) {
          return arg;
        }
        if (arg.includes(" ") || arg.includes(":") || arg.includes("'")) {
          return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
      })
      .join(" ");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createRendiBackend(options: RendiBackendOptions): RendiBackend {
  return new RendiBackend(options);
}

export type { FFmpegBackend } from "../backends/types";
