import { generateImage } from "ai";
import { openai } from "../index";

async function main() {
  console.log("generating image with gpt-image-1...");
  const { images } = await generateImage({
    model: openai.imageModel("gpt-image-1"),
    prompt:
      "a futuristic city at sunset, neon lights reflecting on wet streets",
    size: "1024x1024",
  });

  console.log(`image generated: ${images[0]!.uint8Array.byteLength} bytes`);
  await Bun.write("output/openai-gpt-image.png", images[0]!.uint8Array);

  console.log("\ngenerating with dall-e-3...");
  const { images: dalleImages } = await generateImage({
    model: openai.imageModel("dall-e-3"),
    prompt:
      "a whimsical treehouse in an enchanted forest, fairy lights, cozy atmosphere",
    aspectRatio: "16:9",
    providerOptions: {
      openai: {
        quality: "hd",
        style: "vivid",
      },
    },
  });

  console.log(`dall-e-3 image: ${dalleImages[0]!.uint8Array.byteLength} bytes`);
  await Bun.write("output/openai-dalle3.png", dalleImages[0]!.uint8Array);

  console.log("\ndone!");
}

main().catch(console.error);
