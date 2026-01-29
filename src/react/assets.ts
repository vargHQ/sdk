import { NoirPortrait } from "../characters";

/** @deprecated use `import { NoirPortrait } from "vargai/characters"` instead */
export const assets = {
  characters: {
    orangeGirl: NoirPortrait.imageRefs[0],
  },
  backgrounds: {
    orangeGradient: NoirPortrait.imageRefs[1],
  },
} as const;
