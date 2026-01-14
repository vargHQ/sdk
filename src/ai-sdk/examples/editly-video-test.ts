import { editly } from "../providers/editly";

async function main() {
  console.log("test 1: merge two videos with fade transition\n");

  await editly({
    outPath: "output/editly-merge-test.mp4",
    width: 1280,
    height: 720,
    fps: 30,
    verbose: true,
    clips: [
      {
        layers: [{ type: "video", path: "output/sora-landscape.mp4" }],
        transition: { name: "fade", duration: 0.5 },
      },
      {
        layers: [{ type: "video", path: "output/simpsons-scene.mp4" }],
      },
    ],
  });

  console.log("\ntest 2: picture-in-picture (pip)\n");

  await editly({
    outPath: "output/editly-pip-test.mp4",
    width: 1280,
    height: 720,
    fps: 30,
    verbose: true,
    clips: [
      {
        duration: 5,
        layers: [
          { type: "video", path: "output/sora-landscape.mp4" },
          {
            type: "video",
            path: "output/simpsons-scene.mp4",
            width: 0.3,
            height: 0.3,
            left: 0.68,
            top: 0.02,
          },
        ],
      },
    ],
  });

  console.log("\ndone!");
}

main().catch(console.error);
