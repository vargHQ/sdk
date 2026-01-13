import { fal, generateElement, generateVideo, scene } from "../index";

async function main() {
  console.log("generating ralph...");
  const { element: ralph } = await generateElement({
    model: fal.imageModel("nano-banana-pro"),
    type: "character",
    prompt:
      "ralph wiggum from the simpsons, yellow skin, blue shorts, red shirt, simple cartoon style",
  });
  console.log(`ralph: ${ralph.images.length} images`);

  console.log("generating blackboard...");
  const { element: blackboard } = await generateElement({
    model: fal.imageModel("nano-banana-pro"),
    type: "item",
    prompt:
      "green chalkboard from simpsons intro that says 'I will not run claude code in a loop', white chalk text",
  });
  console.log(`blackboard: ${blackboard.images.length} images`);

  console.log("generating video...");
  const { video } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: scene`${ralph} writes on the ${blackboard}`,
    duration: 5,
  });

  console.log(`video: ${video.uint8Array.byteLength} bytes`);
  await Bun.write("output/simpsons-scene.mp4", video.uint8Array);

  console.log("\ndone!");
}

main().catch(console.error);
