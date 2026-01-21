import { elevenlabs } from "../elevenlabs-provider";
import {
  Captions,
  Clip,
  Image,
  Render,
  render,
  Speech,
} from "../react";

async function main() {
  const speech = Speech({
    model: elevenlabs.speechModel("eleven_multilingual_v2"),
    voice: "adam",
    children: "Hello world! This is a test of the captions system with word level timestamps.",
  });

  const video = (
    <Render width={1080} height={1920}>
      <Clip duration={5}>
        <Image src="media/cyberpunk-street.png" resize="contain" />
      </Clip>
      <Captions src={speech} style="tiktok" />
    </Render>
  );

  console.log("rendering captions demo with speech transcription...\n");

  await render(video, {
    output: "output/captions-demo.mp4",
    cache: ".cache/ai",
  });

  console.log("\ndone! check output/captions-demo.mp4");
}

main().catch(console.error);
