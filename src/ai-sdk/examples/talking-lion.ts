import {
  generateImage,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import { elevenlabs, fal, generateVideo } from "../index";

async function main() {
  const script = `Hey there! I'm Leo the Lion, and I'm here to tell you about the Varg SDK. 
It's an incredible tool that lets you generate videos, images, and speech using AI. 
You can create talking characters like me, animate images into videos, and even add captions automatically. 
The SDK integrates seamlessly with the Vercel AI SDK, so you can use familiar patterns. 
Whether you're building social content or creative apps, Varg has got you covered. Roar!`;

  console.log("generating lion image and voice in parallel...");
  const [imageResult, speechResult] = await Promise.all([
    generateImage({
      model: fal.imageModel("flux-schnell"),
      prompt:
        "majestic lion portrait, photorealistic, facing camera, warm lighting, savanna background, friendly expression",
      n: 1,
    }),
    generateSpeech({
      model: elevenlabs.speechModel("turbo"),
      text: script,
      voice: "adam",
    }),
  ]);

  const imageData = imageResult.images[0]!.uint8Array;
  const audioFile = speechResult.audio;

  console.log(`image: ${imageData.byteLength} bytes`);
  console.log(`audio: ${audioFile.uint8Array.byteLength} bytes`);

  await Bun.write("output/lion-image.png", imageData);
  await Bun.write("output/lion-voice.mp3", audioFile.uint8Array);

  console.log("\nanimating lion (10 seconds)...");
  const { video } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: {
      text: "lion talking and moving its mouth naturally, subtle head movements, breathing, blinking",
      images: [imageData],
    },
    duration: 5,
  });

  console.log(`video: ${video.uint8Array.byteLength} bytes`);
  await Bun.write("output/talking-lion.mp4", video.uint8Array);

  console.log("\ndone! files saved to output/");
}

main().catch(console.error);
