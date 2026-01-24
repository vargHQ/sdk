import { Clip, Render, render, Video } from "./src/react";
import { Slot, Split } from "./src/react/layouts";

const video1 = <Video src="media/fitness-demo.mp4" />;
const video2 = <Video src="media/kangaroo-scene.mp4" />;

await render(
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Split direction="vertical">
        <Slot class="fit-cover pos-top">{video1}</Slot>
        <Slot class="fit-cover pos-bottom">{video2}</Slot>
      </Split>
    </Clip>
  </Render>,
  { output: "output/test-slot.mp4" },
);

console.log("done: output/test-slot.mp4");
