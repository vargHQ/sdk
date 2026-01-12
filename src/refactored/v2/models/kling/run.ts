// models/kling/run.ts

import * as falAdapter from "@/provider/fal/adapters/kling";
import { type KlingParams, schema } from "./schema";

const DEFAULT_PROVIDER = "fal";

export async function run(params: KlingParams) {
  // 1. Validate
  const validated = schema.parse(params);

  // 2. Select provider
  const provider = validated.provider ?? DEFAULT_PROVIDER;

  // 3. Get adapter
  const adapter = getAdapter(provider);

  // 4. Execute
  return adapter.run(validated);
}

function getAdapter(provider: string) {
  const adapters = {
    fal: falAdapter,
    // replicate: replicateAdapter, // future
  };

  if (!adapters[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  return adapters[provider];
}
