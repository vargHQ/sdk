import {
  generateImage,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import { elevenlabs, File, fal, generateVideo } from "../index";

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

  const image = File.from(imageResult.images[0]!);
  const audio = File.from(speechResult.audio);

  console.log(`image: ${(await image.data()).byteLength} bytes`);
  console.log(`audio: ${(await audio.data()).byteLength} bytes`);

  await Bun.write("output/lion-image.png", await image.data());
  await Bun.write("output/lion-voice.mp3", await audio.data());

  console.log("\nanimating lion (5 seconds)...");
  const { video } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: {
      text: "lion talking and moving its mouth naturally, subtle head movements, breathing, blinking",
      images: [await image.data()],
    },
    duration: 5,
  });

  const output = File.from(video);
  console.log(`video: ${(await output.data()).byteLength} bytes`);
  await Bun.write("output/talking-lion.mp4", await output.data());

  console.log("\ndone! files saved to output/");
}

main().catch(console.error);
