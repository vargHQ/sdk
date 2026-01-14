import { generateImage } from "ai";
import { editly, fal } from "../index";

const CHARACTER_PROMPTS = [
  {
    name: "Warrior",
    prompt: "fierce warrior with sword, armor, battle-ready stance",
  },
  {
    name: "Mage",
    prompt: "mystical mage with glowing staff, flowing robes, magical aura",
  },
  {
    name: "Rogue",
    prompt: "stealthy rogue with daggers, hooded cloak, shadows",
  },
  {
    name: "Healer",
    prompt: "gentle healer with staff, white robes, soft light",
  },
  {
    name: "Archer",
    prompt: "skilled archer with bow, leather armor, focused eyes",
  },
  {
    name: "Knight",
    prompt: "noble knight with shield, heavy armor, proud stance",
  },
  {
    name: "Necromancer",
    prompt: "dark necromancer with skull staff, black robes, green magic",
  },
  {
    name: "Paladin",
    prompt: "holy paladin with hammer, golden armor, divine light",
  },
  {
    name: "Bard",
    prompt: "charismatic bard with lute, colorful clothes, smile",
  },
  {
    name: "Druid",
    prompt: "nature druid with wooden staff, leaf clothing, animals",
  },
  {
    name: "Monk",
    prompt: "disciplined monk with wrapped fists, simple robes, calm",
  },
  {
    name: "Assassin",
    prompt: "deadly assassin with hidden blades, dark mask, shadows",
  },
];

async function main() {
  console.log("generating 12 character portraits...\n");

  const baseStyle =
    "fantasy character portrait, stylized art, vibrant colors, detailed, facing camera";

  const images = await Promise.all(
    CHARACTER_PROMPTS.map(async ({ name, prompt }, i) => {
      console.log(`generating ${name}...`);
      const { images } = await generateImage({
        model: fal.imageModel("flux-schnell"),
        prompt: `${prompt}, ${baseStyle}`,
        aspectRatio: "1:1",
        n: 1,
      });
      const data = images[0]!.uint8Array;
      await Bun.write(`output/character-${i}-${name.toLowerCase()}.png`, data);
      return {
        name,
        data,
        path: `output/character-${i}-${name.toLowerCase()}.png`,
      };
    }),
  );

  console.log("\ncreating character grid video...");

  const clips = images.map(({ name, path }) => ({
    duration: 2,
    layers: [
      { type: "image" as const, path },
      {
        type: "title" as const,
        text: name,
        textColor: "#ffffff",
        position: "bottom" as const,
      },
    ],
    transition: { name: "fade", duration: 0.3 },
  }));

  await editly({
    outPath: "output/workflow-character-grid.mp4",
    width: 720,
    height: 720,
    fps: 30,
    verbose: true,
    clips,
  });

  console.log("\ndone! output/workflow-character-grid.mp4");
}

main().catch(console.error);
