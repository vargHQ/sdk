import { Clip, Render, render, Video } from "./src/react";
import { Slot, Split } from "./src/react/layouts";

// Three clips: 1st normal, 2nd has Split, 3rd normal
await render(
  <Render width={1080} height={1920}>
    <Clip duration={2}>
      <Video src="media/fitness-demo.mp4" />
    </Clip>
    <Clip duration={2}>
      <Split direction="vertical">
        <Slot class="fit-cover pos-top">
          <Video src="media/kangaroo-scene.mp4" />
        </Slot>
        <Slot class="fit-cover pos-bottom">
          <Video src="media/Packshot_4x5.mp4" />
        </Slot>
      </Split>
    </Clip>
    <Clip duration={2}>
      <Video src="media/Packshot_9_16.mp4" />
    </Clip>
  </Render>,
  { output: "output/test-bug-b.mp4", verbose: true },
);

console.log("done");
