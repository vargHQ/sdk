/**
 * Core type definitions for varg SDK
 * These types form the foundation of the registry, executor, and provider systems
 */

import type { z } from "zod";

// ============================================================================
// Zod Schema Types
// ============================================================================

/**
 * Schema definition using Zod
 * TInput: Zod schema for input validation
 * TOutput: Zod schema for output type definition
 */
export interface ZodSchema<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  input: TInput;
  output: TOutput;
}

/**
 * Infer the TypeScript type from a ZodSchema's input
 */
export type InferInput<S extends ZodSchema> = z.infer<S["input"]>;

/**
 * Infer the TypeScript type from a ZodSchema's output
 */
export type InferOutput<S extends ZodSchema> = z.infer<S["output"]>;

// ============================================================================
// Legacy Schema Types (for JSON Schema compatibility)
// These are used by CLI introspection via Zod v4's native toJSONSchema()
// ============================================================================

export interface SchemaProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: (string | number)[];
  default?: unknown;
  format?: string;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

export interface JsonSchema {
  type: "object";
  required?: string[];
  properties?: Record<string, SchemaProperty>;
  description?: string;
}

// ============================================================================
// Job Types
// ============================================================================

export type JobStatus =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface Job {
  id: string;
  status: JobStatus;
  provider: string;
  model: string;
  inputs: Record<string, unknown>;
  output?: unknown;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  progress?: number;
  logs?: string[];
}

export interface JobStatusUpdate {
  status: JobStatus;
  progress?: number;
  logs?: string[];
  output?: unknown;
  error?: string;
}

// ============================================================================
// Provider Types
// ============================================================================

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

export interface Provider {
  readonly name: string;

  /**
   * Submit a job to the provider
   * @returns Job ID from the provider
   */
  submit(
    model: string,
    inputs: Record<string, unknown>,
    config?: ProviderConfig,
  ): Promise<string>;

  /**
   * Get the current status of a job
   */
  getStatus(jobId: string): Promise<JobStatusUpdate>;

  /**
   * Get the result of a completed job
   */
  getResult(jobId: string): Promise<unknown>;

  /**
   * Cancel a running job (if supported)
   */
  cancel?(jobId: string): Promise<void>;

  /**
   * Upload a file to the provider's storage (if supported)
   */
  uploadFile?(
    file: File | Blob | ArrayBuffer,
    filename?: string,
  ): Promise<string>;
}

// ============================================================================
// Definition Types
// ============================================================================

export interface ModelDefinition<S extends ZodSchema = ZodSchema> {
  type: "model";
  name: string;
  description: string;
  providers: string[];
  defaultProvider: string;
  schema: S;
  /**
   * Provider-specific model identifiers
   * e.g., { fal: "fal-ai/kling-video/v2.5", replicate: "..." }
   */
  providerModels?: Record<string, string>;
}

export interface ActionRoute {
  /** Target model or action name */
  target: string;
  /** Conditions that must be met for this route */
  when?: Record<string, unknown>;
  /** Priority (higher = preferred) */
  priority?: number;
  /** Transform inputs before passing to target */
  transform?: (inputs: Record<string, unknown>) => Record<string, unknown>;
}

export interface ActionDefinition<S extends ZodSchema = ZodSchema> {
  type: "action";
  name: string;
  description: string;
  schema: S;
  /** Routes to models or other actions */
  routes: ActionRoute[];
  /** Direct execution function (for local actions like ffmpeg) */
  execute?: (inputs: InferInput<S>) => Promise<InferOutput<S>>;
}

export interface SkillStep {
  name: string;
  /** Action or model to run */
  run: string;
  /** Input mapping from previous steps or initial inputs */
  inputs: Record<string, unknown>;
  /** Condition to run this step */
  when?: Record<string, unknown>;
}

export interface SkillDefinition<S extends ZodSchema = ZodSchema> {
  type: "skill";
  name: string;
  description: string;
  schema: S;
  /** Ordered steps to execute */
  steps: SkillStep[];
}

export type Definition =
  | ModelDefinition<ZodSchema>
  | ActionDefinition<ZodSchema>
  | SkillDefinition<ZodSchema>;

// ============================================================================
// Execution Types
// ============================================================================

export interface RunOptions {
  /** Override the default provider */
  provider?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to wait for completion */
  wait?: boolean;
  /** Output directory for downloaded files */
  outputDir?: string;
  /** Progress callback */
  onProgress?: (progress: number, logs?: string[]) => void;
  /** Status change callback */
  onStatusChange?: (status: JobStatus) => void;
}

export interface ExecutionResult {
  /** Primary output (URL or file path) */
  output: string | Record<string, unknown>;
  /** Estimated cost in USD */
  cost?: number;
  /** Duration in milliseconds */
  duration: number;
  /** Provider used */
  provider: string;
  /** Model used */
  model: string;
  /** Job ID for reference */
  jobId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Registry Types
// ============================================================================

export interface RegistryOptions {
  /** Paths to scan for definitions */
  definitionPaths?: string[];
  /** Paths to scan for user skills */
  skillPaths?: string[];
}

export interface SearchOptions {
  /** Filter by type */
  type?: "model" | "action" | "skill";
  /** Filter by input type */
  inputType?: string;
  /** Filter by output type */
  outputType?: string;
  /** Filter by provider */
  provider?: string;
}

// ============================================================================
// Config Types
// ============================================================================

export interface VargConfig {
  /** Default provider for each capability */
  defaults?: {
    imageToVideo?: string;
    textToVideo?: string;
    textToImage?: string;
    textToSpeech?: string;
  };
  /** Provider-specific configuration */
  providers?: Record<string, ProviderConfig>;
  /** Output directory */
  outputDir?: string;
}
