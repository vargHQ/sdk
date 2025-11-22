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
// lib exports - fal (client)
export * from "./lib/fal";
// lib exports - higgsfield
export * from "./lib/higgsfield";
// service exports
export * from "./service/image";
export * from "./service/video";
// utilities exports
export * from "./utilities/s3";
