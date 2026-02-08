/**
 * Google Veo 2/3 Video Template
 * Google's flagship video generation model (2025-2026)
 * 
 * Best for: Photorealistic videos, complex scenes, long-form content
 * Resolution: Up to 4K
 * Duration: Up to 60+ seconds
 */

import { Video, Scene, Sequence } from '@varg/sdk';

// Basic Veo video
export const VeoBasic = () => (
  <Video model="veo-3" duration={8}>
    <Scene>
      Drone shot flying over Norwegian fjords at golden hour,
      mirror-like water reflecting snow-capped mountains,
      a small red fishing boat creating ripples in the stillness
    </Scene>
  </Video>
);

// Veo long-form sequence
export const VeoLongForm = () => (
  <Video model="veo-3" duration={30}>
    <Sequence>
      <Scene duration={10}>
        Wide establishing shot of Tokyo at night, neon signs reflecting
        in rain-slicked streets, crowds moving with umbrellas
      </Scene>
      <Scene duration={10}>
        Following a woman in a red coat through the crowd, camera tracking
        smoothly behind her as she navigates the busy crosswalk
      </Scene>
      <Scene duration={10}>
        She enters a quiet ramen shop, warm steam rising, the chef
        looks up and smiles, intimate close-up of the steaming bowl
      </Scene>
    </Sequence>
  </Video>
);

// Veo photorealistic style
export const VeoPhotorealistic = () => (
  <Video model="veo-3" duration={10}>
    <Scene 
      camera="handheld documentary style"
      style="shot on ARRI Alexa, natural lighting"
    >
      Street food vendor in Bangkok preparing pad thai, flames leaping
      from the wok, ingredients tossed with practiced precision,
      steam and smoke catching the afternoon light
    </Scene>
  </Video>
);

// Veo with complex physics
export const VeoPhysics = () => (
  <Video model="veo-3" duration={8}>
    <Scene>
      Slow motion capture of a glass of red wine being knocked over,
      liquid arcing through the air in perfect fluid dynamics,
      droplets scattering and catching the light like rubies
    </Scene>
  </Video>
);

// Veo commercial template
export const VeoCommercial = ({
  brand,
  product,
  tagline,
  mood = "aspirational, premium"
}: {
  brand: string;
  product: string;
  tagline: string;
  mood?: string;
}) => (
  <Video model="veo-3" duration={15}>
    <Sequence>
      <Scene duration={5} style={mood}>
        {`Cinematic reveal of ${product}, emerging from darkness
        into perfect studio lighting, every detail pristine`}
      </Scene>
      <Scene duration={5}>
        {`${product} in use, lifestyle context, beautiful people,
        golden hour lighting, aspirational setting`}
      </Scene>
      <Scene duration={5}>
        {`Final hero shot of ${product} with ${brand} logo subtle
        in frame, ${tagline} feeling embodied in the visual`}
      </Scene>
    </Sequence>
  </Video>
);

export default VeoBasic;
