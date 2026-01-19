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

  console.log(`source image: ${sourceImages[0]!.uint8Array.byteLength} bytes`);
  await Bun.write("output/bg-removal-source.png", sourceImages[0]!.uint8Array);

  const sourceFile = File.from(sourceImages[0]!);

  console.log("\nremoving background...");
  const { images: processedImages } = await generateImage({
    model: replicate.image("851-labs/background-remover"),
    prompt: {
      images: [await sourceFile.data()],
    },
  });

  console.log(
    `processed image: ${processedImages[0]!.uint8Array.byteLength} bytes`,
  );
  await Bun.write(
    "output/bg-removal-result.png",
    processedImages[0]!.uint8Array,
  );

  console.log("\nusing alternative model...");
  const { images: altImages } = await generateImage({
    model: replicate.image("lucataco/remove-bg"),
    prompt: {
      images: [await sourceFile.data()],
    },
  });

  console.log(`alt result: ${altImages[0]!.uint8Array.byteLength} bytes`);
  await Bun.write("output/bg-removal-alt.png", altImages[0]!.uint8Array);

  console.log("\ndone!");
}

main().catch(console.error);
