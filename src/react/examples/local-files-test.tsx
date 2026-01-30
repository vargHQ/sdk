import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Image, Render, Video } from "..";

export default (
  <Render width={1080} height={1920}>
    <Clip duration={3}>
      <Image src="media/cyberpunk-street.png" />
    </Clip>
    <Clip duration={3}>
      <Video
        prompt={{
          text: "camera pans across the scene",
          images: [Image({ src: "media/fal-coffee-shop.png" })],
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>
  </Render>
);
