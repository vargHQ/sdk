/**
 * Name Resolution Logic
 * Handles smart resolution of names to definitions with fuzzy matching
 */

import type { Definition, SearchOptions } from "../schema/types";
import { registry } from "./registry";

export interface ResolveOptions {
  /** If true, throw an error if not found */
  required?: boolean;
  /** Preferred type to resolve to */
  preferType?: "model" | "action" | "skill";
  /** If true, allow fuzzy matching */
  fuzzy?: boolean;
}

export interface ResolveResult {
  definition: Definition | null;
  matchType: "exact" | "namespace" | "fuzzy" | "alias" | null;
  suggestions?: string[];
}

// Common aliases for actions/models
const ALIASES: Record<string, string> = {
  // Video generation
  i2v: "image-to-video",
  t2v: "text-to-video",
  img2vid: "image-to-video",
  txt2vid: "text-to-video",

  // Image generation
  i2i: "image-to-image",
  t2i: "text-to-image",
  img2img: "image-to-image",
  txt2img: "text-to-image",

  // Voice/Audio
  tts: "text-to-speech",
  stt: "speech-to-text",
  voice: "text-to-speech",

  // Video editing
  concat: "merge",
  join: "merge",
  combine: "merge",
  crop: "trim",
  clip: "trim",
};

/**
 * Resolve a name to a definition with smart matching
 */
export function resolve(name: string, options?: ResolveOptions): ResolveResult {
  // 1. Check direct/exact match
  const exact = registry.resolve(name);
  if (exact) {
    return { definition: exact, matchType: "exact" };
  }

  // 2. Check aliases
  const aliasTarget = ALIASES[name.toLowerCase()];
  if (aliasTarget) {
    const aliased = registry.resolve(aliasTarget);
    if (aliased) {
      return { definition: aliased, matchType: "alias" };
    }
  }

  // 3. Try with namespace prefix if preferType is set
  if (options?.preferType) {
    const namespaced = registry.resolve(`${options.preferType}/${name}`);
    if (namespaced) {
      return { definition: namespaced, matchType: "namespace" };
    }
  }

  // 4. Fuzzy matching if enabled
  if (options?.fuzzy) {
    const suggestions = findSimilar(name);
    const firstSuggestion = suggestions[0];
    if (firstSuggestion) {
      const topMatch = registry.resolve(firstSuggestion);
      if (topMatch) {
        return {
          definition: topMatch,
          matchType: "fuzzy",
          suggestions,
        };
      }
    }
  }

  // 5. Not found
  if (options?.required) {
    const suggestions = findSimilar(name);
    const suggestionText =
      suggestions.length > 0
        ? ` Did you mean: ${suggestions.slice(0, 3).join(", ")}?`
        : "";
    throw new Error(`Definition not found: "${name}".${suggestionText}`);
  }

  return {
    definition: null,
    matchType: null,
    suggestions: findSimilar(name),
  };
}

/**
 * Find similar names using Levenshtein distance
 */
export function findSimilar(query: string, limit = 5): string[] {
  const q = query.toLowerCase();
  const all = registry.list();

  const scored = all.map((def) => ({
    name: def.name,
    score: similarity(q, def.name.toLowerCase()),
  }));

  // Sort by similarity score (higher is better)
  scored.sort((a, b) => b.score - a.score);

  // Return top matches with reasonable similarity
  return scored
    .filter((s) => s.score > 0.3)
    .slice(0, limit)
    .map((s) => s.name);
}

/**
 * Simple similarity score based on common substrings and Levenshtein
 */
function similarity(a: string, b: string): number {
  // Exact match
  if (a === b) return 1;

  // Prefix match
  if (b.startsWith(a) || a.startsWith(b)) return 0.9;

  // Contains match
  if (b.includes(a) || a.includes(b)) return 0.7;

  // Levenshtein-based similarity
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

/**
 * Calculate Levenshtein edit distance
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Create matrix with proper initialization
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) =>
    Array.from({ length: a.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const prevRow = matrix[i - 1];
      const currRow = matrix[i];
      if (!prevRow || !currRow) continue;

      if (b[i - 1] === a[j - 1]) {
        currRow[j] = prevRow[j - 1] ?? 0;
      } else {
        currRow[j] = Math.min(
          (prevRow[j - 1] ?? 0) + 1, // substitution
          (currRow[j - 1] ?? 0) + 1, // insertion
          (prevRow[j] ?? 0) + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length]?.[a.length] ?? Math.max(a.length, b.length);
}

/**
 * Search with filters
 */
export function search(query: string, options?: SearchOptions): Definition[] {
  return registry.search(query, options);
}

/**
 * Get suggestions for partial input (autocomplete)
 */
export function suggest(partial: string, limit = 10): string[] {
  const p = partial.toLowerCase();
  const all = registry.list();

  return all
    .filter((def) => def.name.toLowerCase().startsWith(p))
    .slice(0, limit)
    .map((def) => def.name);
}
