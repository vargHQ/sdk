import { elevenlabs, fal } from "../../ai-sdk";
import { Captions, Clip, Image, Render, Speech } from "..";

const audio = await Speech({
  voice: "adam",
  model: elevenlabs.speechModel("eleven_turbo_v2"),
  children: "The sun sets over the Pacific. Another day ends.",
});
export default (
  <Render width={1080} height={1920}>
    <Clip duration={audio.duration}>
      <Image
        prompt="cinematic sunset over ocean, golden hour, waves crashing on rocks, vivid orange sky"
        model={fal.imageModel("nano-banana-pro")}
        aspectRatio="9:16"
        zoom="in"
      />
      {audio}
    </Clip>
    <Captions src={audio} style="tiktok" />
  </Render>
);
