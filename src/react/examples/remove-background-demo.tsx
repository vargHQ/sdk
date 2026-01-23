import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Image, Render, render, Video } from "..";

const removeBackgroundVideo = (
  <Render width={720} height={720}>
    <Clip duration={3}>
      <Video
        prompt={{
          text: "robot waves hello, friendly gesture, slight head tilt",
          images: [
            Image({
              prompt:
                "a friendly robot waving hello, simple cartoon style, blue and white colors",
              model: fal.imageModel("flux-schnell"),
              aspectRatio: "1:1",
            }),
          ],
        }}
        model={fal.videoModel("wan-2.5")}
        removeBackground={true}
      />
    </Clip>
  </Render>
);

export default removeBackgroundVideo;

async function main() {
  console.log("=== Remove Background Demo ===\n");

  if (!process.env.FAL_API_KEY) {
    console.error("ERROR: FAL_API_KEY not found");
    process.exit(1);
  }

  console.log("generating video with green screen background...");
  console.log("the ai will generate a green background, then ffmpeg removes it\n");

  try {
    const buffer = await render(removeBackgroundVideo, {
      output: "output/remove-background-demo.mov",
      cache: ".cache/ai",
    });

    console.log("\n=== SUCCESS ===");
    console.log(
      `output: output/remove-background-demo.mov (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`,
    );
    console.log("\nthe output has transparent background (alpha channel)");
    console.log("you can use it as an overlay in video editing software");
  } catch (error) {
    console.error("\n=== FAILED ===");
    console.error("error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
