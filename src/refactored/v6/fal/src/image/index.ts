// packages/fal/src/image/index.ts

import { flux } from './flux';
import { recraft } from './recraft';

export const image = {
  name: 'fal.image',
  type: 'image' as const,

  flux,
  recraft,
};
