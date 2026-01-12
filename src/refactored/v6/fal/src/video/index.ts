// packages/fal/src/video/index.ts

import { createModalityProvider } from '@varg/sdk';
import { kling } from './kling';
import { runway } from './runway';
import { minimax } from './minimax';
import { luma } from './luma';

export const video = createModalityProvider({
  name: 'fal.video',
  type: 'video',
  children: { kling, runway, minimax, luma },
});
