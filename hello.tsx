import { elevenlabs, fal } from "vargai/ai";
import {
  Captions,
  Clip,
  Image,
  Music,
  Render,
  render,
  Speech,
  Video,
} from "vargai/react";

const girl = Image({
  prompt:
    "young woman, short dark brown bob with wispy bangs, oval face, fair skin, large dark brown eyes, full lips, silver hoop earrings. deep black background, dramatic orange rim lighting, noir premium aesthetic. 85mm portrait, shallow depth of field",
  model: fal.imageModel("flux-schnell"),
  aspectRatio: "9:16",
});

const voiceover = Speech({
  model: elevenlabs.speechModel("eleven_multilingual_v2"),
  voice: "rachel",
  children: "Hey! Welcome to varg. Let's make some videos together!",
});

await render(
  <Render width={1080} height={1920}>
    <Music
      prompt="upbeat electronic pop, energetic, modern"
      model={elevenlabs.musicModel()}
      volume={0.15}
    />

    <Clip duration={4}>
      <Video
        prompt={{
          text: "woman waves hello enthusiastically, warm smile, friendly expression, studio lighting",
          images: [girl],
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>

    <Captions src={voiceover} style="tiktok" color="#ffffff" />
  </Render>,
  { output: "output/hello.mp4" },
);
