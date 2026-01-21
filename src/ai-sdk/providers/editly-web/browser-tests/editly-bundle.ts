// Bundle entry point for browser tests
// Re-exports editly-web for use in browser test HTML files

export type { EditlyWebConfig } from "../index.ts";
export { editlyWeb } from "../index.ts";
export {
  ColorSource,
  GradientSource,
  HTMLVideoSource,
  ImageSource,
  VideoSource,
} from "../sources.ts";
