/**
 * Replicate Background Removal
 * Required env: REPLICATE_API_TOKEN
 */

import { generateImage } from "ai";
import { File, fal, replicate } from "../index";

async function main() {
  console.log("generating source image...");
  const { images: sourceImages } = await generateImage({
    model: fal.imageModel("flux-schnell"),
    prompt: "a red sports car on a city street, urban background",
    n: 1,
  });

  const firstSourceImage = sourceImages[0];
  if (!firstSourceImage) throw new Error("No source image generated");
  console.log(`source image: ${firstSourceImage.uint8Array.byteLength} bytes`);
  await Bun.write("output/bg-removal-source.png", firstSourceImage.uint8Array);

  const sourceFile = File.from(firstSourceImage);

  console.log("\nremoving background...");
  const { images: processedImages } = await generateImage({
    model: replicate.image("851-labs/background-remover"),
    prompt: {
      images: [await sourceFile.data()],
    },
  });

  const firstProcessedImage = processedImages[0];
  if (!firstProcessedImage) throw new Error("No processed image generated");
  console.log(
    `processed image: ${firstProcessedImage.uint8Array.byteLength} bytes`,
  );
  await Bun.write(
    "output/bg-removal-result.png",
    firstProcessedImage.uint8Array,
  );

  console.log("\nusing alternative model...");
  const { images: altImages } = await generateImage({
    model: replicate.image("lucataco/remove-bg"),
    prompt: {
      images: [await sourceFile.data()],
    },
  });

  const firstAltImage = altImages[0];
  if (!firstAltImage) throw new Error("No alt image generated");
  console.log(`alt result: ${firstAltImage.uint8Array.byteLength} bytes`);
  await Bun.write("output/bg-removal-alt.png", firstAltImage.uint8Array);

  console.log("\ndone!");
}

main().catch(console.error);
