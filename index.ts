/**
 * varg.ai sdk
 * video generation and editing tools
 */

// lib exports
export * from "./lib/fal"
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