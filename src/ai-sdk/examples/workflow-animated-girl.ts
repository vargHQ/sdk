import {
  generateImage as _generateImage,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import {
  generateVideo as _generateVideo,
  elevenlabs,
  fal,
  fileCache,
  withCache,
} from "../index";

const storage = fileCache({ dir: ".cache/ai" });
const generateImage = withCache(_generateImage, { storage });
const generateVideo = withCache(_generateVideo, { storage });

async function main() {
  const script = `Hi everyone! Welcome to my channel. Today I want to share something exciting with you. 
I've been learning about AI video generation, and it's absolutely amazing what we can create now. 
From simple images to fully animated talking characters, the possibilities are endless. 
Don't forget to like and subscribe for more content like this!`;

  console.log("step 1: generating girl image...");
  const { images } = await generateImage({
    model: fal.imageModel("flux-schnell"),
    prompt:
      "young woman portrait, friendly smile, casual style, looking at camera, natural lighting, social media influencer vibe",
    aspectRatio: "9:16",
    n: 1,
    cacheKey: ["animated-girl", "portrait"],
  });

  const imageData = images[0]!.uint8Array;
  await Bun.write("output/workflow-girl-image.png", imageData);
  console.log("saved: output/workflow-girl-image.png");

  console.log("\nstep 2: generating voiceover...");
  const { audio } = await generateSpeech({
    model: elevenlabs.speechModel("turbo"),
    text: script,
    voice: "rachel",
  });

  const audioData = audio.uint8Array;
  await Bun.write("output/workflow-girl-voice.mp3", audioData);
  console.log("saved: output/workflow-girl-voice.mp3");

  console.log("\nstep 3: animating image to video...");
  const { video } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: {
      text: "woman talking naturally, subtle head movements, blinking, friendly expression, lip sync",
      images: [imageData],
    },
    duration: 5,
    cacheKey: ["animated-girl", "video"],
  });

  await Bun.write("output/workflow-girl-animated.mp4", video.uint8Array);
  console.log("saved: output/workflow-girl-animated.mp4");

  console.log("\nstep 4: lip syncing video with audio...");
  const { video: syncedVideo } = await generateVideo({
    model: fal.videoModel("sync-v2"),
    prompt: {
      video: video.uint8Array,
      audio: audioData,
    },
    cacheKey: ["animated-girl", "synced"],
  });

  await Bun.write("output/workflow-girl-synced.mp4", syncedVideo.uint8Array);
  console.log("saved: output/workflow-girl-synced.mp4");

  console.log("\nstep 5: generating captions...");
  const transcription = fal.transcriptionModel("whisper");
  const result = await transcription.doGenerate({
    audio: audioData,
    mediaType: "audio/mpeg",
  });

  const srtContent = result.segments
    .map((seg, i) => {
      const start = formatTime(seg.startSecond);
      const end = formatTime(seg.endSecond);
      return `${i + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join("\n");

  await Bun.write("output/workflow-girl-captions.srt", srtContent);
  console.log("saved: output/workflow-girl-captions.srt");

  console.log("\ndone! all files in output/workflow-girl-*");
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

main().catch(console.error);
