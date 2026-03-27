/**
 * Model definitions index
 */

export { definition as elevenlabsTts } from "./elevenlabs";
export { definition as flux } from "./flux";
export { definition as kling } from "./kling";
export { definition as llama } from "./llama";
export { definition as nanoBanana2 } from "./nano-banana-2";
export { definition as nanoBananaPro } from "./nano-banana-pro";
export { definition as omnihuman } from "./omnihuman";
export {
  photaDefinition as phota,
  photaEditDefinition as photaEdit,
  photaEnhanceDefinition as photaEnhance,
} from "./phota";
export { definition as qwenImage2 } from "./qwen-image-2";
export { definition as recraftV4 } from "./recraft-v4";
export { definition as reve } from "./reve";
export { definition as sonauto } from "./sonauto";
export { definition as soul } from "./soul";
export { definition as veedFabric } from "./veed-fabric";
export { definition as wan } from "./wan";
export { definition as whisper } from "./whisper";

// All model definitions for auto-loading
import { definition as elevenlabsDefinition } from "./elevenlabs";
import { definition as fluxDefinition } from "./flux";
import { definition as klingDefinition } from "./kling";
import { definition as llamaDefinition } from "./llama";
import { definition as nanoBanana2Definition } from "./nano-banana-2";
import { definition as nanoBananaProDefinition } from "./nano-banana-pro";
import { definition as omnihumanDefinition } from "./omnihuman";
import {
  photaDefinition,
  photaEditDefinition,
  photaEnhanceDefinition,
} from "./phota";
import { definition as qwenImage2Definition } from "./qwen-image-2";
import { definition as recraftV4Definition } from "./recraft-v4";
import { definition as reveDefinition } from "./reve";
import { definition as sonautoDefinition } from "./sonauto";
import { definition as soulDefinition } from "./soul";
import { definition as veedFabricDefinition } from "./veed-fabric";
import { definition as wanDefinition } from "./wan";
import { definition as whisperDefinition } from "./whisper";

export const allModels = [
  klingDefinition,
  fluxDefinition,
  nanoBananaProDefinition,
  nanoBanana2Definition,
  qwenImage2Definition,
  recraftV4Definition,
  photaDefinition,
  photaEditDefinition,
  photaEnhanceDefinition,
  reveDefinition,
  wanDefinition,
  omnihumanDefinition,
  veedFabricDefinition,
  whisperDefinition,
  elevenlabsDefinition,
  soulDefinition,
  sonautoDefinition,
  llamaDefinition,
];
