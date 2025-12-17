/**
 * varg.ai SDK
 * AI video generation and editing tools
 */

// Re-export external clients for convenience
export { fal } from "@ai-sdk/fal";
export { replicate } from "@ai-sdk/replicate";
export { fal as falClient } from "@fal-ai/client";
export { HiggsfieldClient } from "@higgsfield/client";
// Core exports
export * from "./core";
export type {
  ActionDefinition,
  Definition,
  ExecutionResult,
  Job,
  JobStatus,
  ModelDefinition,
  Provider,
  ProviderConfig,
  RunOptions,
  Schema,
  SchemaProperty,
  SkillDefinition,
  VargConfig,
} from "./core/schema/types";
// Definition exports
export * from "./definitions";
// Provider exports
export * from "./providers";
