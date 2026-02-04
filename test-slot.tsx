/** @jsxImportSource vargai */
import { Clip, Render, render, Video } from "./src/react/index";
import { Slot, Split } from "./src/react/layouts";

const hookVideo = Video({ src: "media/talking-aleks-animated.mp4" });
const phoneVideo = Video({ src: "media/fitness-demo.mp4" });
const energyVideo = Video({ src: "media/kangaroo-scene.mp4" });
const retestVideo = Video({ src: "media/talking-aleks-final.mp4" });

const video = (
  <Render width={1080} height={1920}>
    <Clip duration={3} cutFrom={1} cutTo={4}>
      {hookVideo}
    </Clip>

    <Clip duration={10}>
      <Split direction="vertical">
        <Slot class="fit-cover pos-top">{energyVideo}</Slot>
        <Slot class="fit-cover pos-top">{phoneVideo}</Slot>
      </Split>
    </Clip>

    <Clip duration={5} cutFrom={0} cutTo={5}>
      {retestVideo}
    </Clip>
  </Render>
);

await render(video, { output: "output/test-slot.mp4" });
console.log("done: output/test-slot.mp4");
