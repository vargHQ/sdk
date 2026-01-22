import { elevenlabs } from "../../ai-sdk/providers/elevenlabs";
import { Clip, Image, Music, Render, render } from "..";

async function main() {
  const video = (
    <Render width={1080} height={1920}>
      <Music
        prompt="chill lo-fi hip hop beats, relaxing piano melody"
        model={elevenlabs.musicModel()}
      />

      <Clip duration={3}>
        <Image src="media/cyberpunk-street.png" resize="cover" />
      </Clip>
      <Clip duration={3}>
        <Image src="media/madi-portrait.png" resize="cover" />
      </Clip>
      <Clip duration={3}>
        <Image src="media/replicate-forest.png" resize="cover" />
      </Clip>
    </Render>
  );

  console.log("testing music auto-trim (no duration specified)");
  console.log("3 clips x 3s = 9s video, music should auto-trim to 9s\n");

  await render(video, {
    output: "output/music-test.mp4",
    cache: ".cache/ai",
  });

  console.log("\ndone! check output/music-test.mp4");
}

main().catch(console.error);
