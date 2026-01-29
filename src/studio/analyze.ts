import { fileCache } from "../ai-sdk/file-cache";
import {
  MODEL_TIME_ESTIMATES,
  TIME_ESTIMATES,
} from "../react/renderers/progress";
import { computeCacheKey } from "../react/renderers/utils";
import type { VargElement } from "../react/types";
import { extractStages, type StageType } from "./stages";

export interface StageAnalysis {
  id: string;
  type: StageType;
  label: string;
  cacheKey: string;
  isCached: boolean;
  estimatedTimeMs: number;
  dependsOn: string[];
}

export interface RenderAnalysis {
  stages: StageAnalysis[];
  order: string[];
  summary: {
    total: number;
    cached: number;
    toGenerate: number;
    estimatedTotalTimeMs: number;
  };
}

/**
 * Gets the function prefix used for cache keys based on stage type.
 * This matches how withCache() generates keys in the render pipeline.
 */
function getCacheFunctionPrefix(type: StageType): string {
  switch (type) {
    case "image":
      return "generateImage";
    case "video":
      return "generateVideo";
    case "speech":
      return "generateSpeech";
    case "music":
      return "generateMusic";
    default:
      return type;
  }
}

/**
 * Converts cache key array to string format matching withCache() depsToKey().
 */
function cacheKeyToString(
  prefix: string,
  deps: (string | number | boolean | null | undefined)[],
): string {
  const depsStr = deps.map((d) => String(d ?? "")).join(":");
  return prefix ? `${prefix}:${depsStr}` : depsStr;
}

/**
 * Gets estimated time in milliseconds for a stage based on its type and model.
 */
function getEstimatedTimeMs(type: StageType, element: VargElement): number {
  const props = element.props as Record<string, unknown>;
  const model = props.model as { modelId?: string } | undefined;
  const modelId = model?.modelId?.toLowerCase() ?? "";

  // Check model-specific estimates first
  for (const [key, seconds] of Object.entries(MODEL_TIME_ESTIMATES)) {
    if (modelId.includes(key.toLowerCase())) {
      return seconds * 1000;
    }
  }

  // Fall back to type-based estimate
  const baseEstimate = TIME_ESTIMATES[type] ?? 30;
  return baseEstimate * 1000;
}

/**
 * Analyzes a render tree and reports cache status for each stage.
 * This allows the UI to show what will be cached vs generated before starting.
 */
export async function analyzeRender(
  element: VargElement,
  cacheDir: string,
): Promise<RenderAnalysis> {
  const cache = fileCache({ dir: cacheDir });
  const { stages, order } = extractStages(element);

  const results: StageAnalysis[] = await Promise.all(
    stages.map(async (stage) => {
      const cacheKeyParts = computeCacheKey(stage.element);
      const prefix = getCacheFunctionPrefix(stage.type);
      const cacheKeyStr = cacheKeyToString(prefix, cacheKeyParts);

      // Check if this key exists in the cache
      const cached = await cache.get(cacheKeyStr);
      const isCached = cached !== undefined;

      // Get estimated time (0 if cached)
      const estimatedTimeMs = isCached
        ? 0
        : getEstimatedTimeMs(stage.type, stage.element);

      return {
        id: stage.id,
        type: stage.type,
        label: stage.label,
        cacheKey: cacheKeyStr,
        isCached,
        estimatedTimeMs,
        dependsOn: stage.dependsOn,
      };
    }),
  );

  const summary = {
    total: results.length,
    cached: results.filter((r) => r.isCached).length,
    toGenerate: results.filter((r) => !r.isCached).length,
    estimatedTotalTimeMs: results.reduce(
      (sum, r) => sum + r.estimatedTimeMs,
      0,
    ),
  };

  return {
    stages: results,
    order,
    summary,
  };
}
