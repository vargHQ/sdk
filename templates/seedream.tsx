/**
 * Seedream 3.0 Video Template
 * ByteDance's latest video generation model (2025)
 * 
 * Best for: Cinematic shots, artistic videos, creative content
 * Resolution: 720p-1080p
 * Duration: 4-10 seconds
 */

import { Video, Scene, Text } from '@varg/sdk';

// Basic Seedream video
export const SeedreamBasic = () => (
  <Video model="seedream-3.0" duration={6}>
    <Scene>
      A lone astronaut stands on Mars, red dust swirling around their boots,
      Earth visible as a pale blue dot in the salmon sky, cinematic lighting
    </Scene>
  </Video>
);

// Seedream with camera motion
export const SeedreamCinematic = () => (
  <Video model="seedream-3.0" duration={8}>
    <Scene 
      camera="slow dolly forward"
      style="film grain, anamorphic lens"
    >
      Ancient temple ruins reclaimed by jungle, shafts of golden sunlight
      piercing through the canopy, mist rising from the forest floor
    </Scene>
  </Video>
);

// Seedream artistic style
export const SeedreamArtistic = () => (
  <Video model="seedream-3.0" duration={6}>
    <Scene style="oil painting, impressionist">
      Café terrace at night, warm lamplight spilling onto cobblestones,
      figures seated at small tables, stars swirling in the sky above
    </Scene>
  </Video>
);

// Product showcase with Seedream
export const SeedreamProduct = ({ 
  productName,
  productDescription,
  style = "luxury commercial"
}: {
  productName: string;
  productDescription: string;
  style?: string;
}) => (
  <Video model="seedream-3.0" duration={6}>
    <Scene style={style}>
      {`${productName} rotating slowly on a reflective black surface,
      dramatic rim lighting, particles of light floating in the air,
      ${productDescription}`}
    </Scene>
  </Video>
);

export default SeedreamBasic;
