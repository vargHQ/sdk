import { Clip, Render, render, Slot, Split, Video } from "./src/react";

const video1 = <Video src="media/fitness-demo.mp4" />;
const video2 = <Video src="media/kangaroo-scene.mp4" />;

const positions = [
  ["pos-top", "pos-top"],
  ["pos-bottom", "pos-bottom"],
  ["pos-center", "pos-center"],
  ["pos-top", "pos-bottom"],
] as const;

for (const [pos1, pos2] of positions) {
  const outFile = `output/test-slot-pr-${pos1}-${pos2}.mp4`;

  await render(
    <Render width={1080} height={1920}>
      <Clip duration={3}>
        <Split direction="vertical">
          <Slot class={`fit-cover ${pos1}`}>{video1}</Slot>
          <Slot class={`fit-cover ${pos2}`}>{video2}</Slot>
        </Split>
      </Clip>
    </Render>,
    { output: outFile },
  );

  console.log(`done: ${outFile}`);
}
