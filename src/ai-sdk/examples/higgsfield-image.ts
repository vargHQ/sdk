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

  const firstImage = images[0];
  if (!firstImage) throw new Error("No image generated");
  console.log(`image generated: ${firstImage.uint8Array.byteLength} bytes`);
  await Bun.write("output/higgsfield-default.png", firstImage.uint8Array);

  console.log("\ngenerating with model settings...");
  const { images: styledImages } = await generateImage({
    model: higgsfield.imageModel("soul", {
      quality: "1080p",
    }),
    prompt:
      "a cyberpunk street scene at night, neon lights reflecting on wet pavement",
    aspectRatio: "16:9",
  });

  const firstStyledImage = styledImages[0];
  if (!firstStyledImage) throw new Error("No styled image generated");
  console.log(`styled image: ${firstStyledImage.uint8Array.byteLength} bytes`);
  await Bun.write(
    "output/higgsfield-cinematic.png",
    firstStyledImage.uint8Array,
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

  const firstEnhancedImage = enhancedImages[0];
  if (!firstEnhancedImage) throw new Error("No enhanced image generated");
  console.log(
    `enhanced image: ${firstEnhancedImage.uint8Array.byteLength} bytes`,
  );
  await Bun.write(
    "output/higgsfield-enhanced.png",
    firstEnhancedImage.uint8Array,
  );

  console.log("\ndone!");
}

main().catch(console.error);
