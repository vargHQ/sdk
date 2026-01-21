import { fal } from "../../ai-sdk/fal-provider";
import { Clip, Grid, Image, Render, render, Title } from "..";

const CHARACTER_PROMPTS = [
  { name: "Warrior", prompt: "fierce warrior with sword, armor" },
  { name: "Mage", prompt: "mystical mage with glowing staff, robes" },
  { name: "Rogue", prompt: "stealthy rogue with daggers, hooded" },
  { name: "Healer", prompt: "gentle healer with staff, white robes" },
  { name: "Archer", prompt: "skilled archer with bow, leather armor" },
  { name: "Knight", prompt: "noble knight with shield, heavy armor" },
  { name: "Necro", prompt: "dark necromancer with skull staff" },
  { name: "Paladin", prompt: "holy paladin with hammer, golden armor" },
  { name: "Bard", prompt: "charismatic bard with lute, colorful" },
  { name: "Druid", prompt: "nature druid with wooden staff, leaves" },
  { name: "Monk", prompt: "disciplined monk with wrapped fists" },
  { name: "Assassin", prompt: "deadly assassin with hidden blades" },
];

async function main() {
  console.log("creating 3x4 character grid...\n");

  const baseStyle = "fantasy portrait, stylized art, vibrant colors";

  const images = CHARACTER_PROMPTS.map(({ prompt }) =>
    Image({
      prompt: `${prompt}, ${baseStyle}`,
      model: fal.imageModel("flux-schnell"),
    }),
  );

  const video = (
    <Render width={1080} height={1440}>
      <Clip duration={5}>
        <Grid columns={3}>{images}</Grid>
        <Title position="bottom" color="#ffffff">
          Fantasy Characters
        </Title>
      </Clip>
    </Render>
  );

  console.log("video tree:", JSON.stringify(video, null, 2));

  const buffer = await render(video, {
    output: "output/react-grid.mp4",
    cache: ".cache/ai",
  });

  console.log(`\ndone! ${buffer.byteLength} bytes`);
  console.log("output: output/react-grid.mp4");
}

main().catch(console.error);
