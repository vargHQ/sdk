import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Image, Overlay, Render, render, Video } from "..";

// background: construction worker
const constructionWorker = Image({
  prompt: "construction worker in hard hat and orange vest, working on building site, holding tools, industrial background, realistic photo",
  model: fal.imageModel("flux-schnell"),
  aspectRatio: "9:16",
});

// foreground: influencer doing makeup (will be on green screen)
const influencer = Image({
  prompt: "young woman instagram influencer doing makeup tutorial, holding makeup brush, looking at camera, beauty vlogger style, portrait",
  model: fal.imageModel("flux-schnell"),
  aspectRatio: "9:16",
});

const pipDemo = (
  <Render width={1080} height={1920}>
    {/* background video */}
    <Clip duration={5}>
      <Video
        prompt={{
          text: "construction worker hammering, building, hard work, sweat on forehead",
          images: [constructionWorker],
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>
    {/* foreground overlay with green screen removal */}
    <Overlay left="55%" top="55%" width="40%" height="40%">
      <Video
        prompt={{
          text: "woman applying lipstick, looking in mirror, makeup tutorial, beauty influencer",
          images: [influencer],
        }}
        model={fal.videoModel("wan-2.5")}
        removeBackground={{ color: "#00FF00", tolerance: 0.15 }}
      />
    </Overlay>
  </Render>
);

export default pipDemo;

async function main() {
  console.log("=== PiP Green Screen Demo ===\n");
  console.log("background: construction worker");
  console.log("foreground: influencer doing makeup (green screen removed)\n");

  if (!process.env.FAL_API_KEY && !process.env.FAL_KEY) {
    console.error("ERROR: FAL_API_KEY or FAL_KEY not found");
    process.exit(1);
  }

  try {
    const buffer = await render(pipDemo, {
      output: "output/pip-greenscreen-demo.mp4",
      cache: ".cache/ai",
      verbose: true,
    });

    console.log("\n=== SUCCESS ===");
    console.log(
      `output: output/pip-greenscreen-demo.mp4 (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`,
    );
  } catch (error) {
    console.error("\n=== FAILED ===");
    console.error("error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
