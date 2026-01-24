import { generateImage } from "ai";
import { google } from "../providers/google";

async function main() {
  console.log("testing google image generation via varg provider...\n");

  // test 1: text-to-image
  console.log("1. text-to-image with nano-banana-pro...");
  try {
    const { images, warnings } = await generateImage({
      model: google.imageModel("nano-banana-pro"),
      prompt:
        "a beautiful mountain landscape with snow peaks and a calm lake reflecting the mountains",
    });

    console.log(`   generated ${images.length} image(s)`);
    if (warnings.length > 0) {
      console.log(
        `   warnings: ${warnings.map((w) => ("details" in w ? w.details : w.type)).join(", ")}`,
      );
    }
    if (images[0]) {
      console.log(`   size: ${images[0].uint8Array.byteLength} bytes`);
      await Bun.write("output/google-mountain.png", images[0].uint8Array);
      console.log("   saved to output/google-mountain.png");
    }
  } catch (error: any) {
    console.error("   error:", error.message || error);
  }

  // test 2: image-to-image (edit)
  console.log("\n2. image-to-image with nano-banana-pro/edit...");
  try {
    const sourceImage = await Bun.file(
      "output/google-mountain.png",
    ).arrayBuffer();

    const { images, warnings } = await generateImage({
      model: google.imageModel("nano-banana-pro/edit"),
      prompt:
        "transform this into a sunset scene with warm orange and pink colors in the sky",
    });

    console.log(`   generated ${images.length} image(s)`);
    if (warnings.length > 0) {
      console.log(
        `   warnings: ${warnings.map((w) => ("details" in w ? w.details : w.type)).join(", ")}`,
      );
    }
    if (images[0]) {
      console.log(`   size: ${images[0].uint8Array.byteLength} bytes`);
      await Bun.write(
        "output/google-mountain-sunset.png",
        images[0].uint8Array,
      );
      console.log("   saved to output/google-mountain-sunset.png");
    }
  } catch (error: any) {
    console.error("   error:", error.message || error);
  }

  console.log("\ndone!");
}

main();
