export interface Character {
  name: string;
  description: string;
  prompt: string;
  style: string;
  tags: string[];
}

export const KawaiiOrange: Character = {
  name: "KawaiiOrange",
  description:
    "A cute kawaii fluffy orange fruit character with plush body and tiny feet",
  prompt: `Cute kawaii fluffy orange fruit character, round plush body with fuzzy felt texture, small black dot eyes, tiny curved smile, four small round feet, soft studio lighting, 3D render, minimal design, warm cozy aesthetic, Pixar style cuteness, green leaf on top, solid orange background matching the character`,
  style:
    "3D render, Pixar style, plush texture, studio lighting, minimal design",
  tags: ["kawaii", "fruit", "cute", "kids", "3d", "pixar", "animation"],
};
