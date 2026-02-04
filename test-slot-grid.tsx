/** @jsxImportSource vargai */
import { Clip, Render, render, Video } from "./src/react";
import { Grid, Slot } from "./src/react/layouts";

const video1 = <Video src="media/fitness-demo.mp4" />;
const video2 = <Video src="media/kangaroo-scene.mp4" />;

await render(
  <Render width={1080} height={1920}>
    <Clip duration={3}>
      <Grid columns={1} rows={2}>
        <Slot class="fit-cover pos-top">{video1}</Slot>
        <Slot class="fit-cover pos-bottom">{video2}</Slot>
      </Grid>
    </Clip>
  </Render>,
  { output: "output/test-slot-grid.mp4" },
);

console.log("done: output/test-slot-grid.mp4");
