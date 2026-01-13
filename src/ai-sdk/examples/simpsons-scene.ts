import { generateImage } from "ai";
import { File, fal, generateElement, generateVideo, scene } from "../index";

async function main() {
  console.log("generating ralph...");

  const ralphShot = await File.fromPath("media/ralph.jpg").arrayBuffer();

  const { element: ralph } = await generateElement({
    model: fal.imageModel("nano-banana-pro/edit"),
    type: "character",
    prompt: {
      text: "ralph wiggum from the simpsons, yellow skin, blue shorts, red shirt, simple cartoon style",
      images: [ralphShot],
    },
  });
  console.log(`ralph: ${ralph.images.length} images`);

  await Promise.all(
    ralph.images.map((img, i) => Bun.write(`output/ralph-${i}.png`, img)),
  );

  console.log("generating blackboard...");
  const { element: blackboard } = await generateElement({
    model: fal.imageModel("nano-banana-pro"),
    type: "item",
    prompt:
      "green chalkboard from simpsons intro that says 'I will not run claude code in a loop', white chalk text",
  });
  console.log(`blackboard: ${blackboard.images.length} images`);

  await Promise.all(
    blackboard.images.map((img, i) =>
      Bun.write(`output/blackboard-${i}.png`, img),
    ),
  );

  const { image: firstFrame } = await generateImage({
    model: fal.imageModel("nano-banana-pro/edit"),
    prompt: scene`${ralph} writes on the ${blackboard}`,
  });

  console.log("generating video...");
  const { video } = await generateVideo({
    model: fal.videoModel("wan-2.5"),
    prompt: {
      text: `${ralph.text} writes on the ${blackboard.text}`,
      images: [firstFrame.base64],
    },
    duration: 5,
  });

  console.log(`video: ${video.uint8Array.byteLength} bytes`);
  await Bun.write("output/simpsons-scene.mp4", video.uint8Array);

  console.log("\ndone!");
}

main().catch(console.error);
