import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Grid, Render, render, Title, Video } from "..";

async function main() {
  console.log("creating 2x2 video grid...\n");

  const video = (
    <Render width={1920} height={1080}>
      <Clip duration={5}>
        <Grid columns={2}>
          <Video
            prompt="ocean waves crashing on rocks, slow motion, cinematic"
            model={fal.videoModel("wan-2.5")}
          />
          <Video
            prompt="fire burning in fireplace, cozy, warm light"
            model={fal.videoModel("wan-2.5")}
          />
          <Video
            prompt="rain falling on window glass, close up, moody"
            model={fal.videoModel("wan-2.5")}
          />
          <Video
            prompt="clouds moving across blue sky, timelapse, peaceful"
            model={fal.videoModel("wan-2.5")}
          />
        </Grid>
        <Title position="bottom" color="#ffffff">
          Elements
        </Title>
      </Clip>
    </Render>
  );

  console.log("video tree:", JSON.stringify(video, null, 2));

  const buffer = await render(video, {
    output: "output/react-video-grid.mp4",
    cache: ".cache/ai",
  });

  console.log(`\ndone! ${buffer.byteLength} bytes`);
  console.log("output: output/react-video-grid.mp4");
}

main().catch(console.error);
