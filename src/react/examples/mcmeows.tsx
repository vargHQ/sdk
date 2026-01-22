import { elevenlabs } from "../../ai-sdk/providers/elevenlabs";
import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Music, Render, render, Title, Video } from "..";

export default (
  <Render>
    <Clip duration={4}>
      <Video prompt="A sophisticated tabby cat wearing a tailored tiny business suit and small round glasses, standing upright at a McDonald's counter. One paw raised pointing assertively at the illuminated menu board above. The cat has an extremely serious, concentrated expression with furrowed brows. Cinematic lighting with warm McDonald's interior ambiance, shallow depth of field focusing on the cat's determined face, photorealistic fur texture with fine detail. Professional business atmosphere meets fast food chaos." />
    </Clip>

    <Clip duration={4}>
      <Video prompt="Absolute mayhem - four to five cats in a chaotic pile fight. Orange tabby, black and white tuxedo cat, calico with patches, and fluffy gray cat all scrambling, paws flailing, tumbling over each other in exaggerated cartoon-style motion. They're all desperately reaching for a single perfect golden McDonald's french fry sitting on a red plastic tray in the center. Wide-eyed expressions, mouths open mid-meow, dynamic motion blur, comedic timing. Fast food restaurant background slightly blurred. Playful, over-the-top energy." />
    </Clip>

    <Clip duration={3}>
      <Video prompt="Proud orange tabby cat wearing an official McDonald's crew member visor and name tag, standing upright behind a restaurant register counter. Front paws crossed confidently across chest, chin lifted with a smug, self-satisfied expression. Perfect posture, professional demeanor. Bright McDonald's interior lighting, red and yellow color scheme in background. The cat radiates 'employee of the month' energy. Crisp, clean, professional fast food aesthetic." />
      <Title position="bottom">McMeow's: NOW HIRING</Title>
    </Clip>

    <Music
      model={elevenlabs.musicModel()}
      prompt="playful upbeat comedy music with quirky pizzicato strings and light percussion, funny corporate training video vibes"
      duration={11}
    />
  </Render>
);

async function main() {
  const component = await import("./mcmeows.tsx").then((m) => m.default);
  await render(component, {
    output: "output/mcmeows.mp4",
    cache: ".cache/ai",
    verbose: true,
    defaults: {
      video: fal.videoModel("wan-2.5"),
    },
  });
}

main().catch(console.error);
