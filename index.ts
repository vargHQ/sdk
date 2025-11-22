/**
 * varg.ai sdk
 * video generation and editing tools
 */

// lib exports - fal (client)
export * from "./lib/fal"
// lib exports - ai-sdk/fal (provider)
export * as aiSdkFal from "./lib/ai-sdk/fal"
// lib exports - higgsfield
export * from "./lib/higgsfield"

// service exports
export * from "./service/image"
export * from "./service/video"

// utilities exports
export * from "./utilities/s3"

// re-export external clients
export { fal } from "@ai-sdk/fal"
export { replicate } from "@ai-sdk/replicate"
export { HiggsfieldClient } from "@higgsfield/client"
export { fal as falClient } from "@fal-ai/client"