import { generateImage } from "ai";
import { File, google } from "../index";

async function main() {
  console.log("testing google image generation via varg provider...\n");

  console.log("1. text-to-image with nano-banana-pro...");
  try {
    const { images, warnings } = await generateImage({
      model: google.imageModel("nano-banana-pro"),
      prompt: "a beautiful mountain landscape with snow peaks and a calm lake",
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

  console.log("\n2. image-to-image with nano-banana-pro/edit...");
  try {
    const sourceFile = File.fromPath("output/google-mountain.png");

    const { images, warnings } = await generateImage({
      model: google.imageModel("nano-banana-pro/edit"),
      prompt: {
        text: "transform into a sunset scene with warm orange and pink sky",
        images: [await sourceFile.data()],
      },
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
