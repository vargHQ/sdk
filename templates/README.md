# vargHQ SDK Templates

Ready-to-use video generation templates for modern AI models (2025-2026).

## Models Supported

| Model | Provider | Best For | Duration |
|-------|----------|----------|----------|
| **Kling 3.0** | Kuaishou | Motion, action, dynamic scenes | 5-10s |
| **Veo 3** | Google | Photorealistic, long-form, complex | Up to 60s |
| **Seedream 3.0** | ByteDance | Cinematic, artistic, creative | 4-10s |

## Quick Start

```tsx
import { KlingAction } from '@varg/templates/kling';
import { VeoCommercial } from '@varg/templates/veo';
import { SeedreamCinematic } from '@varg/templates/seedream';

// Action sequence with Kling
<KlingAction 
  subject="parkour athlete"
  action="backflip off rooftop"
  environment="cyberpunk city at night"
/>

// Commercial with Veo
<VeoCommercial
  brand="Acme"
  product="wireless headphones"
  tagline="Sound without limits"
/>

// Artistic video with Seedream
<SeedreamCinematic />
```

## Templates

### Kling (`kling.tsx`)
- `KlingBasic` - Simple prompt-based video
- `KlingAction` - Dynamic action sequences
- `KlingImageToVideo` - Animate a reference image
- `KlingProduct` - Product showcase

### Veo (`veo.tsx`)
- `VeoBasic` - Drone/landscape shots
- `VeoLongForm` - Multi-scene sequences
- `VeoPhotorealistic` - Documentary style
- `VeoPhysics` - Complex physics/fluid
- `VeoCommercial` - Brand commercials

### Seedream (`seedream.tsx`)
- `SeedreamBasic` - Cinematic scenes
- `SeedreamCinematic` - Camera motion + style
- `SeedreamArtistic` - Painterly/artistic
- `SeedreamProduct` - Luxury product shots

## Model Selection Guide

```
Need action/motion? → Kling 3.0
Need 4K or 30+ seconds? → Veo 3
Need artistic style? → Seedream 3.0
```

## Usage Tips

1. **Be specific** - Describe lighting, camera, mood
2. **Use camera directions** - "slow dolly", "tracking shot", "POV"
3. **Reference film styles** - "shot on ARRI", "anamorphic lens"
4. **Layer details** - Environment, subject, action, atmosphere
