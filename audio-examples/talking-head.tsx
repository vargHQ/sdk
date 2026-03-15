import { elevenlabs, fal } from "../../ai-sdk";
import { Captions, Clip, Image, type Render, Speech, Video } from "..";

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

// Scene 1: girl talking head (lipsync with VEED)
const talkingHead = Video({
  prompt: { images: [portrait], audio: audio1 },
  model: fal.videoModel("veed-fabric-1.0"),
  keepAudio: true,
});

export default (
  <Render width={1080} height={1920}>
    {/* Scene 1: talking head — audio baked into the lipsync video */}
    <Clip duration={audio1.duration}>
      {talkingHead}
      <Captions src={audio1} style="tiktok" />
    </Clip>

    {/* Scene 2: science b-roll — audio2 as voiceover */}
    <Clip duration={audio2.duration}>
      <Video
        prompt="macro shot of a banana being peeled and sliced, scientific diagram overlay showing potassium molecules, bright lab lighting, educational documentary style"
        model={fal.videoModel("kling-v3")}
        duration={audio2.duration}
      />
      {audio2}
      <Captions src={audio2} style="tiktok" />
    </Clip>
  </Render>
);
