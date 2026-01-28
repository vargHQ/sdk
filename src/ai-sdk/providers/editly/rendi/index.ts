import type {
  FFmpegBackend,
  FFmpegRunOptions,
  FFmpegRunResult,
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

export class RendiBackend implements FFmpegBackend {
  readonly name = "rendi";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.RENDI_API_KEY ?? "";
    if (!this.apiKey) {
      throw new Error("RENDI_API_KEY is required for Rendi backend");
    }
  }

  async ffprobe(input: string): Promise<VideoInfo> {
    const inputUrl = this.ensureUrl(input);

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

  async run(options: FFmpegRunOptions): Promise<FFmpegRunResult> {
    const { args, inputs, outputPath, verbose } = options;

    const uniqueInputs = [...new Set(inputs)];
    const inputUrls = uniqueInputs.map((input) => this.ensureUrl(input));

    const inputFiles: Record<string, string> = {};
    const pathToPlaceholder = new Map<string, string>();

    for (let i = 0; i < uniqueInputs.length; i++) {
      const placeholder = `in_${i + 1}`;
      inputFiles[placeholder] = inputUrls[i]!;
      pathToPlaceholder.set(uniqueInputs[i]!, `{{${placeholder}}}`);
    }

    const commandArgs = args.map((arg) => {
      if (arg === outputPath) {
        return "{{out_1}}";
      }
      const placeholder = pathToPlaceholder.get(arg);
      if (placeholder) {
        return placeholder;
      }
      let result = arg;
      for (const [url, ph] of pathToPlaceholder) {
        if (result.includes(url)) {
          result = result.replace(url, ph);
        }
      }
      return result;
    });

    const filteredArgs = this.stripInternalFlags(commandArgs);
    const ffmpegCommand = this.buildCommandString(filteredArgs);

    const outputFilename = outputPath?.split("/").pop() ?? "output.mp4";
    const finalCommand = ffmpegCommand.includes("{{out_1}}")
      ? ffmpegCommand
      : ffmpegCommand.replace(/[^\s]+\.\w+$/, "{{out_1}}");

    if (verbose) {
      console.log("[rendi] input_files:", inputFiles);
      console.log("[rendi] ffmpeg_command:", finalCommand);
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
        ffmpeg_command: finalCommand,
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

  private ensureUrl(input: string): string {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      return input;
    }
    throw new Error(`Rendi backend requires URLs, got local path: ${input}`);
  }

  private stripInternalFlags(args: string[]): string[] {
    const filtered: string[] = [];
    let skipNext = false;

    for (const arg of args) {
      if (skipNext) {
        skipNext = false;
        continue;
      }

      if (arg === "-hide_banner") continue;
      if (arg === "-y") continue;
      if (arg === "-loglevel") {
        skipNext = true;
        continue;
      }

      filtered.push(arg);
    }

    return filtered;
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

export function createRendiBackend(apiKey?: string): RendiBackend {
  return new RendiBackend(apiKey);
}

export type { FFmpegBackend } from "../backends/types";
