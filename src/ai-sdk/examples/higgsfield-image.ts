/**
 * Higgsfield Soul Image Generation
 * Required env: HIGGSFIELD_API_KEY, HIGGSFIELD_SECRET
 */

import { generateImage } from "ai";
import { createHiggsfield, higgsfield } from "../index";

async function main() {
  console.log("generating with default settings...");
  const { images } = await generateImage({
    model: higgsfield.imageModel("soul"),
    prompt:
      "a photorealistic portrait of a wise elderly man with deep blue eyes",
    aspectRatio: "1:1",
  });

  console.log(`image generated: ${images[0]!.uint8Array.byteLength} bytes`);
  await Bun.write("output/higgsfield-default.png", images[0]!.uint8Array);

  console.log("\ngenerating with model settings...");
  const { images: styledImages } = await generateImage({
    model: higgsfield.imageModel("soul", {
      quality: "1080p",
    }),
    prompt:
      "a cyberpunk street scene at night, neon lights reflecting on wet pavement",
    aspectRatio: "16:9",
  });

  console.log(`styled image: ${styledImages[0]!.uint8Array.byteLength} bytes`);
  await Bun.write(
    "output/higgsfield-cinematic.png",
    styledImages[0]!.uint8Array,
  );

  console.log("\ngenerating with provider defaults...");
  const customHiggsfield = createHiggsfield({
    defaultModelSettings: {
      enhancePrompt: true,
    },
  });

  const { images: enhancedImages } = await generateImage({
    model: customHiggsfield.imageModel("soul"),
    prompt: "a serene japanese garden with cherry blossoms",
    aspectRatio: "4:3",
  });

  console.log(
    `enhanced image: ${enhancedImages[0]!.uint8Array.byteLength} bytes`,
  );
  await Bun.write(
    "output/higgsfield-enhanced.png",
    enhancedImages[0]!.uint8Array,
  );

  console.log("\ndone!");
}

main().catch(console.error);
