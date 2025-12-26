/**
 * Model definitions index
 */

export { definition as elevenlabsTts } from "./elevenlabs";
export { definition as flux } from "./flux";
export { definition as kling } from "./kling";
export { definition as llama } from "./llama";
export { definition as nanoBananaPro } from "./nano-banana-pro";
export { definition as sonauto } from "./sonauto";
export { definition as soul } from "./soul";
export { definition as wan } from "./wan";
export { definition as whisper } from "./whisper";

// All model definitions for auto-loading
import { definition as elevenlabsDefinition } from "./elevenlabs";
import { definition as fluxDefinition } from "./flux";
import { definition as klingDefinition } from "./kling";
import { definition as llamaDefinition } from "./llama";
import { definition as nanoBananaProDefinition } from "./nano-banana-pro";
import { definition as sonautoDefinition } from "./sonauto";
import { definition as soulDefinition } from "./soul";
import { definition as wanDefinition } from "./wan";
import { definition as whisperDefinition } from "./whisper";

export const allModels = [
  klingDefinition,
  fluxDefinition,
  nanoBananaProDefinition,
  wanDefinition,
  whisperDefinition,
  elevenlabsDefinition,
  soulDefinition,
  sonautoDefinition,
  llamaDefinition,
];
