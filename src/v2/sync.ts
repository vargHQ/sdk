import type { SyncModel, SyncOptions, SyncResult } from "./types";

export interface SyncOpts extends Omit<SyncOptions, "abortSignal"> {
  model: SyncModel;
  abortSignal?: AbortSignal;
}

export async function sync(options: SyncOpts): Promise<SyncResult> {
  const { model, ...rest } = options;
  return model.doSync(rest);
}
