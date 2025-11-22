/**
 * varg.ai sdk
 * video generation and editing tools
 */

// re-export external clients
export { fal } from "@ai-sdk/fal";
export { replicate } from "@ai-sdk/replicate";
export { fal as falClient } from "@fal-ai/client";
export { HiggsfieldClient } from "@higgsfield/client";
// lib exports - ai-sdk/fal (provider)
export * as aiSdkFal from "./lib/ai-sdk/fal";
// lib exports - ai-sdk/replicate (provider)
export * as aiSdkReplicate from "./lib/ai-sdk/replicate";
// lib exports - elevenlabs
export * from "./lib/elevenlabs";
// lib exports - fal (client)
export * from "./lib/fal";
// lib exports - ffmpeg
export * from "./lib/ffmpeg";
// lib exports - fireworks
export * from "./lib/fireworks";
// lib exports - groq
export * from "./lib/groq";
// lib exports - higgsfield
export * from "./lib/higgsfield";
// lib exports - replicate
export * from "./lib/replicate";
// service exports
export * from "./service/captions";
export * from "./service/image";
export * from "./service/sync";
export * from "./service/transcribe";
export * from "./service/video";
export * from "./service/voice";
// utilities exports
export * from "./utilities/s3";
