// providers/fal/video.ts
import * as kling from "./models/kling";

// providers/fal/video.ts
export function video(model: string) {
    const models = {
      'kling': kling
    }
    
    return {
      run: models[model].run,
      schema: models[model].schema,
    }
  }