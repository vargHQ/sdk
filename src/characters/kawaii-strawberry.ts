export interface Character {
  name: string;
  description: string;
  prompt: string;
  style: string;
  tags: string[];
}

export const KawaiiStrawberry: Character = {
  name: "KawaiiStrawberry",
  description:
    "A cute kawaii fluffy strawberry fruit character with plush body and tiny seeds",
  prompt: `Cute kawaii fluffy strawberry fruit character, round plush body with fuzzy felt texture, small black dot eyes, tiny curved smile, four small round feet, soft studio lighting, 3D render, minimal design, warm cozy aesthetic, Pixar style cuteness, tiny green leaves on top, small yellow seeds on body, solid pink-red background matching the character`,
  style:
    "3D render, Pixar style, plush texture, studio lighting, minimal design",
  tags: ["kawaii", "fruit", "cute", "kids", "3d", "pixar", "animation"],
};
