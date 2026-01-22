import { elevenlabs } from "../../ai-sdk/providers/elevenlabs";
import { Clip, Image, Music, Render, render } from "..";

export default (
  <Render width={1920} height={1080}>
    <Clip duration={5}>
      <Image src="media/cyberpunk-street.png" />
    </Clip>
    <Music prompt="calm ambient electronic music" duration={5} />
  </Render>
);

async function main() {
  const component = await import("./music-defaults.tsx").then((m) => m.default);
  await render(component, {
    output: "output/music-defaults.mp4",
    defaults: {
      music: elevenlabs.musicModel(),
    },
  });
  console.log("done! check output/music-defaults.mp4");
}

main().catch(console.error);
