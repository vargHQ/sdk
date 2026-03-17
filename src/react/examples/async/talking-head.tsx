import { elevenlabs } from "../../../ai-sdk/providers/elevenlabs";
import { fal } from "../../../ai-sdk/providers/fal";
import { Captions, Clip, Image, Render, Speech, Video } from "../..";

// Two fragments of narration
const audio1 = await Speech({
  voice: "rachel",
  model: elevenlabs.speechModel("eleven_turbo_v2"),
  children: "Did you know, if you eat just one banana a day...",
});

const audio2 = await Speech({
  voice: "rachel",
  model: elevenlabs.speechModel("eleven_turbo_v2"),
  children:
    "You get enough potassium to keep your heart, muscles, and nerves working properly. Science is delicious.",
});

// Portrait for the talking head
const portrait = Image({
  prompt:
    "friendly young woman in her 20s, casual outfit, warm smile, clean white background, YouTube creator vibe, soft studio lighting",
  model: fal.imageModel("nano-banana-pro"),
  aspectRatio: "9:16",
});

// Scene 1: lipsync talking head via VEED Fabric
const talkingHead = Video({
  prompt: { images: [portrait], audio: audio1 },
  model: fal.videoModel("veed-fabric-1.0"),
  keepAudio: true,
  providerOptions: { fal: { resolution: "720p" } },
});

export default (
  <Render width={1080} height={1920}>
    {/* Scene 1: talking head — lipsync via VEED, audio baked in */}
    <Clip duration={audio1.duration}>
      {talkingHead}
      <Captions src={audio1} style="tiktok" withAudio />
    </Clip>

    {/* Scene 2: science b-roll — image + voiceover via captions */}
    <Clip duration={audio2.duration}>
      <Image
        prompt="macro shot of banana being peeled and sliced, potassium molecule diagrams overlaid, bright lab lighting, educational documentary style"
        model={fal.imageModel("nano-banana-pro")}
        aspectRatio="9:16"
        zoom="out"
      />
      <Captions src={audio2} style="tiktok" withAudio />
    </Clip>
  </Render>
);
