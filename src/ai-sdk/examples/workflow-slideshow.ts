import {
  generateImage as _generateImage,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import {
  generateVideo as _generateVideo,
  editly,
  elevenlabs,
  fal,
  fileCache,
  withCache,
} from "../index";

const storage = fileCache({ dir: ".cache/ai" });
const generateImage = withCache(_generateImage, { storage });
const generateVideo = withCache(_generateVideo, { storage });

const SCENES = [
  "standing in a modern coffee shop, holding a latte",
  "walking in a beautiful park with autumn leaves",
  "sitting at a desk in a bright home office",
  "cooking in a stylish modern kitchen",
  "relaxing on a cozy couch with a book",
  "standing on a rooftop with city skyline behind",
];

async function main() {
  const characterBase =
    "young professional woman, brown hair, warm smile, casual chic style";
  const narration = `Let me take you through a day in my life. 
Morning starts with my favorite coffee. 
Then a refreshing walk in the park. 
Time to get some work done. 
Cooking something delicious for lunch. 
Afternoon reading session. 
And ending with this amazing view.`;

  console.log("step 1: generating 6 scene images...");
  const sceneImages = await Promise.all(
    SCENES.map(async (scene, i) => {
      console.log(`  generating scene ${i + 1}: ${scene.slice(0, 40)}...`);
      const { images } = await generateImage({
        model: fal.imageModel("flux-schnell"),
        prompt: `${characterBase}, ${scene}, lifestyle photography`,
        aspectRatio: "16:9",
        n: 1,
        cacheKey: ["slideshow", "scene", i],
      });
      const data = images[0]!.uint8Array;
      await Bun.write(`output/workflow-scene-${i}.png`, data);
      return `output/workflow-scene-${i}.png`;
    }),
  );
  console.log("saved: output/workflow-scene-*.png");

  console.log("\nstep 2: generating talking head image...");
  const { images: talkingImages } = await generateImage({
    model: fal.imageModel("flux-schnell"),
    prompt: `${characterBase}, headshot, facing camera, talking, vlog style, clean background`,
    aspectRatio: "1:1",
    n: 1,
    cacheKey: ["slideshow", "talking-head"],
  });

  const talkingImage = talkingImages[0]!.uint8Array;
  await Bun.write("output/workflow-talking-head.png", talkingImage);

  console.log("\nstep 3: generating voiceover...");
  const { audio } = await generateSpeech({
    model: elevenlabs.speechModel("turbo"),
    text: narration,
    voice: "bella",
  });

  const audioData = audio.uint8Array;
  await Bun.write("output/workflow-slideshow-voice.mp3", audioData);

  console.log("\nstep 4: animating talking head...");
  const { video: talkingVideo } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: {
      text: "woman talking naturally, subtle head movements, friendly expression",
      images: [talkingImage],
    },
    duration: 5,
    cacheKey: ["slideshow", "talking-video"],
  });

  await Bun.write("output/workflow-talking-head.mp4", talkingVideo.uint8Array);

  console.log("\nstep 5: lip syncing talking head...");
  const { video: syncedTalkingVideo } = await generateVideo({
    model: fal.videoModel("sync-v2"),
    prompt: {
      video: talkingVideo.uint8Array,
      audio: audioData,
    },
    cacheKey: ["slideshow", "synced-video"],
  });

  await Bun.write(
    "output/workflow-talking-synced.mp4",
    syncedTalkingVideo.uint8Array,
  );

  console.log("\nstep 6: generating captions...");
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

  await Bun.write("output/workflow-slideshow.srt", srtContent);

  console.log("\nstep 7: creating slideshow with pip...");
  const clips = sceneImages.map((imagePath, i) => ({
    duration: 2,
    layers: [
      { type: "image" as const, path: imagePath },
      {
        type: "video" as const,
        path: "output/workflow-talking-synced.mp4",
        width: 0.25,
        height: 0.25,
        left: 0.73,
        top: 0.73,
      },
    ],
    transition: { name: "fade", duration: 0.3 } as const,
  }));

  await editly({
    outPath: "output/workflow-slideshow.mp4",
    width: 1280,
    height: 720,
    fps: 30,
    verbose: true,
    audioFilePath: "output/workflow-slideshow-voice.mp3",
    clips,
  });

  console.log("\ndone! output/workflow-slideshow.mp4");
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

main().catch(console.error);
