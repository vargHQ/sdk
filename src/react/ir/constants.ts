import type { VargElement } from "../types";
import type { OpKind } from "./types";

/** Element types that map 1:1 to a generation/processing Step. */
export const OP_BY_TYPE: Partial<Record<VargElement["type"], OpKind>> = {
  image: "generate-image",
  video: "generate-video",
  speech: "generate-speech",
  music: "generate-music",
  "talking-head": "talking-head",
  audio: "extract-audio",
  slice: "slice",
  ffmpeg: "ffmpeg",
  probe: "probe",
};

/** Container types we recurse into via children. */
export const CONTAINER_TYPES = new Set<VargElement["type"]>([
  "render",
  "clip",
  "overlay",
  "split",
  "slider",
  "swipe",
]);

/** Element types that require a model prop when generating (not src/pre-resolved). */
export const GENERATABLE_TYPES = new Set<VargElement["type"]>([
  "image",
  "video",
  "speech",
  "music",
  "talking-head",
]);
