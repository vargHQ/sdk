import { fal } from "../fal-provider";
import { Clip, Image, Render, Subtitle, Title, Video } from "../react";

export const Ralph = (
  <Render width={1080} height={1920}>
    <Clip duration={5}>
      <Video
        prompt={{
          text: "ralph says 'I'm in danger'",
          images: [
            Image({
              prompt: {
                text: "ralph staring blankly",
                images: ["./media/ralph.jpg"],
              },
              model: fal.imageModel("nano-banana-pro/edit"),
            }),
          ],
        }}
        model={fal.videoModel("wan-2.5")}
        duration={5}
        keepAudio
      />

      {/* centered title */}
      <Title>I'M IN DANGER</Title>

      {/* positioned title */}
      <Title position="top" color="#ffffff">
        Episode 1
      </Title>

      {/* subtitle with background */}
      <Subtitle>the beginning of something special</Subtitle>
    </Clip>
  </Render>
);

export default Ralph;
