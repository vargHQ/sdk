#!/usr/bin/env bun
/**
 * video generation service combining fal and higgsfield
 * usage: bun run service/video.ts <command> <args>
 */

import { imageToVideo, textToVideo } from "../lib/fal";
import { uploadFromUrl } from "../utilities/s3";

export interface VideoGenerationResult {
  videoUrl: string;
  duration?: number;
  uploaded?: string;
}

export async function generateVideoFromImage(
  prompt: string,
  imageUrl: string,
  options: { duration?: 5 | 10; upload?: boolean } = {},
): Promise<VideoGenerationResult> {
  console.log("[service/video] generating video from image");

  const result = await imageToVideo({
    prompt,
    imageUrl,
    duration: options.duration,
  });

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) {
    throw new Error("no video url in result");
  }

  let uploaded: string | undefined;
  if (options.upload) {
    const timestamp = Date.now();
    const objectKey = `videos/generated/${timestamp}.mp4`;
    uploaded = await uploadFromUrl(videoUrl, objectKey);
    console.log(`[service/video] uploaded to ${uploaded}`);
  }

  return {
    videoUrl,
    duration: result.data?.duration,
    uploaded,
  };
}

export async function generateVideoFromText(
  prompt: string,
  options: { duration?: 5 | 10; upload?: boolean } = {},
): Promise<VideoGenerationResult> {
  console.log("[service/video] generating video from text");

  const result = await textToVideo({
    prompt,
    duration: options.duration,
  });

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) {
    throw new Error("no video url in result");
  }

  let uploaded: string | undefined;
  if (options.upload) {
    const timestamp = Date.now();
    const objectKey = `videos/generated/${timestamp}.mp4`;
    uploaded = await uploadFromUrl(videoUrl, objectKey);
    console.log(`[service/video] uploaded to ${uploaded}`);
  }

  return {
    videoUrl,
    duration: result.data?.duration,
    uploaded,
  };
}

// cli runner
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "from_image": {
      if (!args[0] || !args[1]) {
        console.log(`
usage:
  bun run service/video.ts from_image <prompt> <imageUrl> [duration] [upload]
        `);
        process.exit(1);
      }
      const duration = args[2];
      if (duration && duration !== "5" && duration !== "10") {
        console.error("duration must be 5 or 10");
        process.exit(1);
      }
      const imgResult = await generateVideoFromImage(args[0], args[1], {
        duration: duration === "10" ? 10 : 5,
        upload: args[3] === "true",
      });
      console.log(JSON.stringify(imgResult, null, 2));
      break;
    }

    case "from_text": {
      if (!args[0]) {
        console.log(`
usage:
  bun run service/video.ts from_text <prompt> [duration] [upload]
        `);
        process.exit(1);
      }
      const duration = args[1];
      if (duration && duration !== "5" && duration !== "10") {
        console.error("duration must be 5 or 10");
        process.exit(1);
      }
      const txtResult = await generateVideoFromText(args[0], {
        duration: duration === "10" ? 10 : 5,
        upload: args[2] === "true",
      });
      console.log(JSON.stringify(txtResult, null, 2));
      break;
    }

    default:
      console.log(`
usage:
  bun run service/video.ts from_image <prompt> <imageUrl> [duration] [upload]
  bun run service/video.ts from_text <prompt> [duration] [upload]
      `);
      process.exit(1);
  }
}
