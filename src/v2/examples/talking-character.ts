/**
 * Talking Character Pipeline
 * Creates a talking character video with lipsync and captions
 *
 * Usage:
 *   bun run src/v2/examples/talking-character.ts
 */

import { addCaptions, transform } from "../ffmpeg";
import {
  generateImage,
  generateVideo,
  generateVoice,
  sync,
  transcribe,
} from "../index";
import { elevenlabs } from "../providers/elevenlabs";
import { fal } from "../providers/fal";

interface TalkingCharacterOptions {
  characterPrompt: string;
  script: string;
  voice?: string;
  outputFormat?: "tiktok" | "instagram" | "youtube";
}

export async function createTalkingCharacter(options: TalkingCharacterOptions) {
  const {
    characterPrompt,
    script,
    voice = "rachel",
    outputFormat = "tiktok",
  } = options;

  // parallel: headshot + voiceover (no dependencies)
  console.log("[1-2/6] generating character and voiceover...");
  const [imageResult, voiceResult] = await Promise.all([
    generateImage({
      model: fal.image("flux-pro"),
      prompt: `professional headshot, ${characterPrompt}, studio lighting, neutral background`,
      size: "1:1",
    }),
    generateVoice({
      model: elevenlabs.tts("eleven_multilingual_v2"),
      text: script,
      voice,
    }),
  ]);

  const image = imageResult.images[0]!;
  const audio = voiceResult.audio;

  // sequential: animate → lipsync → caption → format
  console.log("[3/6] animating character...");
  const { video: animated } = await generateVideo({
    model: fal.video("kling-v2.5"),
    prompt:
      "person talking naturally, subtle head movements, professional demeanor",
    image: image.url,
    duration: 5,
  });

  console.log("[4/6] adding lipsync...");
  const { video: lipsynced } = await sync({
    model: fal.sync("lipsync"),
    video: animated.url,
    audio: audio.url,
  });

  console.log("[5/6] transcribing + captioning...");
  const { segments } = await transcribe({
    model: fal.transcription("whisper"),
    audio: audio.url,
  });

  const captioned = await addCaptions({
    video: lipsynced.url,
    segments,
    style: "tiktok",
  });

  console.log("[6/6] formatting for social...");
  const final = await transform({
    video: captioned.url,
    format: outputFormat,
  });

  return {
    headshot: image,
    voiceover: audio,
    animated,
    lipsynced,
    captioned,
    final,
  };
}

// run if executed directly
if (import.meta.main) {
  const result = await createTalkingCharacter({
    characterPrompt: "friendly female tech founder in her 30s",
    script:
      "hey everyone! today i want to share three tips that completely changed how i work...",
    voice: "rachel",
    outputFormat: "tiktok",
  });

  console.log("done!", {
    headshot: result.headshot.url,
    final: result.final.url,
  });
}
