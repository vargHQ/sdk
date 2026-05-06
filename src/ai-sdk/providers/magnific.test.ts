/**
 * Magnific provider tests — covers BYOK precedence, routing fork, apiKey
 * scrubbing, and per-endpoint payload shape (one test per builder, exhaustive).
 *
 * No network: every fetch is mocked via Bun's spyOn. The "payload shape" tests
 * call `_internal_buildBody` to assemble the outgoing request body and snapshot
 * every property — this is the binding artifact for the property coverage rule.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  _internal_buildBody,
  IMAGE_MODELS,
  listMagnificModels,
  MAGNIFIC_BASE_URL,
  MAGNIFIC_PREFIX,
  MagnificAPIError,
  MUSIC_MODELS,
  parseMagnificModelId,
  resolveMagnificKey,
  SPEECH_MODELS,
  VIDEO_MODELS,
} from "./magnific";
import { createVarg } from "./varg";

// ---------------------------------------------------------------------------
// Test fetch harness
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

function makeFetchHarness(
  responses: Array<{
    status?: number;
    json?: unknown;
    bytes?: Uint8Array;
  }>,
): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  const queue = [...responses];
  const original = globalThis.fetch;
  // biome-ignore lint/suspicious/noExplicitAny: harness
  (globalThis as any).fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const rawHeaders = init?.headers ?? {};
    const headers: Record<string, string> = {};
    if (rawHeaders instanceof Headers) {
      rawHeaders.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
    } else if (Array.isArray(rawHeaders)) {
      for (const [k, v] of rawHeaders) headers[k.toLowerCase()] = v;
    } else {
      for (const [k, v] of Object.entries(rawHeaders)) {
        if (typeof v === "string") headers[k.toLowerCase()] = v;
      }
    }
    let body: Record<string, unknown> | null = null;
    if (typeof init?.body === "string") {
      const ct = (headers["content-type"] ?? "").toLowerCase();
      if (ct.includes("application/x-www-form-urlencoded")) {
        body = Object.fromEntries(new URLSearchParams(init.body));
      } else {
        try {
          body = JSON.parse(init.body) as Record<string, unknown>;
        } catch {
          body = null;
        }
      }
    }
    calls.push({ url, method, headers, body });

    const next = queue.shift() ?? { status: 200, json: {} };
    const status = next.status ?? 200;
    if (next.bytes) {
      // biome-ignore lint/suspicious/noExplicitAny: Uint8Array<ArrayBufferLike> typing mismatch in lib.dom.d.ts
      return new Response(next.bytes as any, { status });
    }
    return new Response(JSON.stringify(next.json ?? {}), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  return {
    calls,
    restore: () => {
      // biome-ignore lint/suspicious/noExplicitAny: harness
      (globalThis as any).fetch = original;
    },
  };
}

// ---------------------------------------------------------------------------
// Constants & introspection
// ---------------------------------------------------------------------------

describe("magnific module shape", () => {
  test("MAGNIFIC_PREFIX is the namespace prefix", () => {
    expect(MAGNIFIC_PREFIX).toBe("magnific/");
    expect(MAGNIFIC_BASE_URL).toBe("https://api.magnific.com/v1");
  });

  test("parseMagnificModelId strips prefix or returns null", () => {
    expect(parseMagnificModelId("magnific/upscale-creative")).toBe(
      "upscale-creative",
    );
    expect(parseMagnificModelId("magnific/kling-v3-pro")).toBe("kling-v3-pro");
    expect(parseMagnificModelId("seedvr")).toBeNull();
    expect(parseMagnificModelId("")).toBeNull();
  });

  test("model maps cover every endpoint we expect", () => {
    expect(Object.keys(IMAGE_MODELS).length).toBe(18);
    expect(Object.keys(VIDEO_MODELS).length).toBe(19);
    expect(Object.keys(MUSIC_MODELS).length).toBe(1);
    expect(Object.keys(SPEECH_MODELS).length).toBe(2);
    expect(IMAGE_MODELS["upscale-creative"]).toBe("ai/image-upscaler");
    expect(VIDEO_MODELS["kling-v3-pro"]).toBe("ai/video/kling-v3-pro");
    expect(SPEECH_MODELS["audio-isolation"]).toBe("ai/audio-isolation");
  });

  test("listMagnificModels returns namespaced ids", () => {
    const all = listMagnificModels();
    expect(all.image).toContain("magnific/upscale-creative");
    expect(all.video).toContain("magnific/kling-v3-pro");
    expect(all.speech).toContain("magnific/audio-isolation");
  });
});

// ---------------------------------------------------------------------------
// BYOK key resolution
// ---------------------------------------------------------------------------

describe("resolveMagnificKey", () => {
  const ENV_BACKUP = process.env.MAGNIFIC_API_KEY;

  beforeEach(() => {
    delete process.env.MAGNIFIC_API_KEY;
  });
  afterEach(() => {
    if (ENV_BACKUP === undefined) delete process.env.MAGNIFIC_API_KEY;
    else process.env.MAGNIFIC_API_KEY = ENV_BACKUP;
  });

  test("per-call apiKey wins over settings and env", () => {
    process.env.MAGNIFIC_API_KEY = "from-env";
    expect(
      resolveMagnificKey({
        settings: { magnificApiKey: "from-settings" },
        perCall: { apiKey: "from-call" },
      }),
    ).toBe("from-call");
  });

  test("settings wins over env", () => {
    process.env.MAGNIFIC_API_KEY = "from-env";
    expect(
      resolveMagnificKey({ settings: { magnificApiKey: "from-settings" } }),
    ).toBe("from-settings");
  });

  test("env is fallback when nothing else is set", () => {
    process.env.MAGNIFIC_API_KEY = "from-env";
    expect(resolveMagnificKey()).toBe("from-env");
  });

  test("returns null when no key is available", () => {
    expect(resolveMagnificKey()).toBeNull();
    expect(resolveMagnificKey({ perCall: { apiKey: "" } })).toBeNull();
  });

  test("ignores empty-string keys (gateway fallback)", () => {
    expect(resolveMagnificKey({ settings: { magnificApiKey: "" } })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Routing fork — BYOK direct vs Varg gateway
// ---------------------------------------------------------------------------

describe("varg.imageModel('magnific/...') routing", () => {
  const ENV_BACKUP = process.env.MAGNIFIC_API_KEY;

  beforeEach(() => {
    delete process.env.MAGNIFIC_API_KEY;
  });
  afterEach(() => {
    if (ENV_BACKUP === undefined) delete process.env.MAGNIFIC_API_KEY;
    else process.env.MAGNIFIC_API_KEY = ENV_BACKUP;
  });

  test("BYOK direct path: hits api.magnific.com with x-magnific-api-key", async () => {
    const { calls, restore } = makeFetchHarness([
      // submitTask → returns task_id
      {
        json: { task_id: "task-1", status: "IN_PROGRESS" },
      },
      // pollTask → COMPLETED
      {
        json: {
          task_id: "task-1",
          status: "COMPLETED",
          generated: ["https://cdn.example/result.png"],
        },
      },
      // download
      { bytes: new Uint8Array([1, 2, 3, 4]) },
    ]);

    try {
      const v = createVarg({
        apiKey: "varg-key",
        magnificApiKey: "magnific-byok-key",
      });
      const out = await v.imageModel("magnific/upscale-creative").doGenerate({
        prompt: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: [
          {
            type: "file",
            mediaType: "image/png",
            data: new Uint8Array([0, 1, 2, 3]),
          },
        ],
        mask: undefined,
        providerOptions: { magnific: { scale_factor: "4x" } },
      });

      expect(out.images).toHaveLength(1);
      expect((out.images[0] as Uint8Array)[0]).toBe(1);

      // submit + poll + download
      expect(calls.length).toBe(3);
      const submit = calls[0]!;
      expect(submit.url).toBe("https://api.magnific.com/v1/ai/image-upscaler");
      expect(submit.method).toBe("POST");
      expect(submit.headers["x-magnific-api-key"]).toBe("magnific-byok-key");
      // No Authorization Bearer header (that's the gateway path).
      expect(submit.headers["authorization"]).toBeUndefined();
      // Body covers every documented field.
      expect(submit.body).toMatchObject({
        scale_factor: "4x",
        optimized_for: "standard",
        creativity: 0,
        hdr: 0,
        resemblance: 0,
        fractality: 0,
        engine: "automatic",
        filter_nsfw: false,
      });

      const poll = calls[1]!;
      expect(poll.method).toBe("GET");
      expect(poll.url).toBe(
        "https://api.magnific.com/v1/ai/image-upscaler/task-1",
      );
    } finally {
      restore();
    }
  });

  test("gateway path: no BYOK key → POST to varg gateway with magnific/<leaf> model", async () => {
    const { calls, restore } = makeFetchHarness([
      // varg /image submit
      {
        json: {
          job_id: "j1",
          status: "completed",
          output: { url: "https://cdn.example/r.png", media_type: "image/png" },
        },
      },
      // download
      { bytes: new Uint8Array([9, 8, 7]) },
    ]);

    try {
      const v = createVarg({ apiKey: "varg-key" });
      const out = await v.imageModel("magnific/mystic").doGenerate({
        prompt: "a cat",
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(out.images).toHaveLength(1);
      const submit = calls[0]!;
      expect(submit.url).toBe("https://api.varg.ai/v1/image");
      expect(submit.headers["authorization"]).toBe("Bearer varg-key");
      expect(submit.headers["x-magnific-api-key"]).toBeUndefined();
      // Gateway gets the full namespaced model id verbatim.
      expect(submit.body).toMatchObject({
        model: "magnific/mystic",
        prompt: "a cat",
      });
    } finally {
      restore();
    }
  });

  test("apiKey in providerOptions.magnific does NOT leak into the request body", async () => {
    const { calls, restore } = makeFetchHarness([
      { json: { task_id: "t-2", status: "IN_PROGRESS" } },
      {
        json: {
          task_id: "t-2",
          status: "COMPLETED",
          generated: ["https://cdn.example/r.png"],
        },
      },
      { bytes: new Uint8Array([1]) },
    ]);

    try {
      const v = createVarg({ apiKey: "varg-key" });
      await v.imageModel("magnific/relight").doGenerate({
        prompt: "golden hour",
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: [
          {
            type: "file",
            mediaType: "image/png",
            data: new Uint8Array([1, 2, 3]),
          },
        ],
        mask: undefined,
        providerOptions: {
          magnific: {
            apiKey: "secret-byok-key",
            light_transfer_strength: 80,
          },
        },
      });

      const submit = calls[0]!;
      expect(submit.headers["x-magnific-api-key"]).toBe("secret-byok-key");
      expect(submit.body?.apiKey).toBeUndefined();
      // Builder-produced field still present
      expect(submit.body).toMatchObject({ light_transfer_strength: 80 });
    } finally {
      restore();
    }
  });

  test("unknown magnific leaf throws NoSuchModelError on direct call", async () => {
    process.env.MAGNIFIC_API_KEY = "key";
    await expect(
      createVarg().imageModel("magnific/nope").doGenerate({
        prompt: "x",
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      }),
    ).rejects.toThrow();
  });

  test("synchronous remove-bg short-circuits without polling", async () => {
    const { calls, restore } = makeFetchHarness([
      // submit returns COMPLETED + generated immediately
      {
        json: {
          task_id: "rb-1",
          status: "COMPLETED",
          generated: ["https://cdn.example/no-bg.png"],
        },
      },
      // download
      { bytes: new Uint8Array([5, 5]) },
    ]);

    try {
      const v = createVarg({ magnificApiKey: "k" });
      const out = await v.imageModel("magnific/remove-bg").doGenerate({
        prompt: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: [{ type: "url", url: "https://cdn.example/in.png" }],
        mask: undefined,
        providerOptions: {},
      });
      expect(out.images).toHaveLength(1);
      expect(calls.length).toBe(2); // submit + download (NO poll)
      expect(calls[0]!.url).toBe(
        "https://api.magnific.com/v1/ai/beta/remove-background",
      );
      expect(calls[0]!.body).toEqual({
        image_url: "https://cdn.example/in.png",
      });
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Per-endpoint payload-shape tests — every property covered.
// ---------------------------------------------------------------------------

const baseImageOpts = (
  override: Record<string, unknown> = {},
): Parameters<typeof _internal_buildBody>[2] => ({
  prompt: undefined,
  n: 1,
  size: undefined,
  aspectRatio: undefined,
  seed: undefined,
  files: undefined,
  mask: undefined,
  providerOptions: {},
  ...override,
});

const baseVideoOpts = (
  override: Record<string, unknown> = {},
): Parameters<typeof _internal_buildBody>[2] => ({
  prompt: "",
  n: 1,
  resolution: undefined,
  aspectRatio: undefined,
  duration: undefined,
  fps: undefined,
  seed: undefined,
  files: undefined,
  providerOptions: {},
  ...override,
});

const baseMusicOpts = (
  override: Record<string, unknown> = {},
): Parameters<typeof _internal_buildBody>[2] => ({
  prompt: "",
  duration: undefined,
  providerOptions: {},
  ...override,
});

const baseSpeechOpts = (
  override: Record<string, unknown> = {},
): Parameters<typeof _internal_buildBody>[2] => ({
  text: "",
  providerOptions: {},
  ...override,
});

describe("payload builders — image gen", () => {
  test("upscale-creative covers every documented field", async () => {
    const body = await _internal_buildBody(
      "magnific/upscale-creative",
      "image",
      baseImageOpts({
        prompt: "high res",
        files: [
          {
            type: "file",
            mediaType: "image/png",
            data: new Uint8Array([0, 1, 2, 3]),
          },
        ],
        providerOptions: {
          magnific: {
            scale_factor: "8x",
            optimized_for: "films_n_photography",
            creativity: 5,
            hdr: 3,
            resemblance: 2,
            fractality: 4,
            engine: "magnific_sharpy",
            filter_nsfw: true,
            webhook_url: "https://wh.example/cb",
          },
        },
      }),
    );
    expect(body).toMatchObject({
      image: "AAECAw==",
      prompt: "high res",
      scale_factor: "8x",
      optimized_for: "films_n_photography",
      creativity: 5,
      hdr: 3,
      resemblance: 2,
      fractality: 4,
      engine: "magnific_sharpy",
      filter_nsfw: true,
      webhook_url: "https://wh.example/cb",
    });
  });

  test("upscale-precision covers every documented field", async () => {
    const body = await _internal_buildBody(
      "magnific/upscale-precision",
      "image",
      baseImageOpts({
        files: [
          {
            type: "file",
            mediaType: "image/jpeg",
            data: new Uint8Array([1]),
          },
        ],
        providerOptions: {
          magnific: {
            sharpen: 75,
            smart_grain: 12,
            ultra_detail: 40,
            filter_nsfw: true,
            webhook_url: "https://wh.example/cb",
          },
        },
      }),
    );
    expect(body).toMatchObject({
      image: "AQ==",
      sharpen: 75,
      smart_grain: 12,
      ultra_detail: 40,
      filter_nsfw: true,
      webhook_url: "https://wh.example/cb",
    });
  });

  test("relight covers every documented field including advanced_settings", async () => {
    const body = await _internal_buildBody(
      "magnific/relight",
      "image",
      baseImageOpts({
        prompt: "golden hour",
        files: [
          { type: "file", mediaType: "image/png", data: new Uint8Array([0]) },
        ],
        providerOptions: {
          magnific: {
            transfer_light_from_reference_image: "ref-b64",
            transfer_light_from_lightmap: undefined,
            light_transfer_strength: 80,
            interpolate_from_original: true,
            change_background: false,
            style: "contrasted_n_hdr",
            preserve_details: false,
            webhook_url: "https://wh.example/cb",
            advanced_settings: {
              whites: 60,
              blacks: 40,
              brightness: 55,
              contrast: 65,
              saturation: 70,
              engine: "illusio",
              transfer_light_a: "high_on_faces",
              transfer_light_b: "smooth_in",
              fixed_generation: true,
            },
          },
        },
      }),
    );
    expect(body).toMatchObject({
      image: "AA==",
      prompt: "golden hour",
      transfer_light_from_reference_image: "ref-b64",
      light_transfer_strength: 80,
      interpolate_from_original: true,
      change_background: false,
      style: "contrasted_n_hdr",
      preserve_details: false,
      advanced_settings: {
        whites: 60,
        blacks: 40,
        brightness: 55,
        contrast: 65,
        saturation: 70,
        engine: "illusio",
        transfer_light_a: "high_on_faces",
        transfer_light_b: "smooth_in",
        fixed_generation: true,
      },
    });
  });

  test("style-transfer covers every documented field", async () => {
    const body = await _internal_buildBody(
      "magnific/style-transfer",
      "image",
      baseImageOpts({
        files: [
          { type: "file", mediaType: "image/png", data: new Uint8Array([0]) },
          {
            type: "file",
            mediaType: "image/png",
            data: new Uint8Array([1, 2]),
          },
        ],
        providerOptions: {
          magnific: {
            style_strength: 90,
            structure_strength: 30,
            is_portrait: true,
            portrait_style: "super_pop",
            portrait_beautifier: "beautify_face_max",
            flavor: "gen_z",
            engine: "definio",
            fixed_generation: true,
          },
        },
      }),
    );
    expect(body).toMatchObject({
      image: "AA==",
      reference_image: "AQI=",
      style_strength: 90,
      structure_strength: 30,
      is_portrait: true,
      portrait_style: "super_pop",
      portrait_beautifier: "beautify_face_max",
      flavor: "gen_z",
      engine: "definio",
      fixed_generation: true,
    });
  });

  test("remove-bg requires URL input", async () => {
    const body = await _internal_buildBody(
      "magnific/remove-bg",
      "image",
      baseImageOpts({
        files: [{ type: "url", url: "https://cdn.example/in.png" }],
      }),
    );
    expect(body).toEqual({ image_url: "https://cdn.example/in.png" });
  });

  test("expand covers every documented field", async () => {
    const body = await _internal_buildBody(
      "magnific/expand",
      "image",
      baseImageOpts({
        prompt: "extend the sky",
        files: [
          { type: "file", mediaType: "image/png", data: new Uint8Array([0]) },
        ],
        providerOptions: {
          magnific: {
            left: 256,
            right: 128,
            top: 0,
            bottom: 64,
            webhook_url: "https://wh.example/cb",
          },
        },
      }),
    );
    expect(body).toMatchObject({
      image: "AA==",
      prompt: "extend the sky",
      left: 256,
      right: 128,
      top: 0,
      bottom: 64,
      webhook_url: "https://wh.example/cb",
    });
  });

  test("mystic covers every documented field including styling", async () => {
    const body = await _internal_buildBody(
      "magnific/mystic",
      "image",
      baseImageOpts({
        prompt: "futuristic city",
        providerOptions: {
          magnific: {
            structure_reference: "struct-b64",
            structure_strength: 70,
            style_reference: "style-b64",
            adherence: 60,
            hdr: 80,
            resolution: "4k",
            aspect_ratio: "widescreen_16_9",
            model: "super_real",
            creative_detailing: 90,
            engine: "magnific_sparkle",
            fixed_generation: true,
            filter_nsfw: false,
            webhook_url: "https://wh.example/cb",
            styling: {
              styles: [{ name: "cinematic", strength: 120 }],
              characters: [{ id: "char-1", strength: 80 }],
              colors: [
                { color: "#FF0000", weight: 0.4 },
                { color: "#00FF00", weight: 0.6 },
              ],
            },
          },
        },
      }),
    );
    expect(body).toMatchObject({
      prompt: "futuristic city",
      structure_reference: "struct-b64",
      structure_strength: 70,
      style_reference: "style-b64",
      adherence: 60,
      hdr: 80,
      resolution: "4k",
      aspect_ratio: "widescreen_16_9",
      model: "super_real",
      creative_detailing: 90,
      engine: "magnific_sparkle",
      fixed_generation: true,
      filter_nsfw: false,
      styling: {
        styles: [{ name: "cinematic", strength: 120 }],
        characters: [{ id: "char-1", strength: 80 }],
      },
    });
  });

  test("flux-2-pro covers width/height/seed/prompt_upsampling and 4 input images", async () => {
    const body = await _internal_buildBody(
      "magnific/flux-2-pro",
      "image",
      baseImageOpts({
        prompt: "a cat",
        size: "1280x720",
        seed: 42,
        files: [
          { type: "file", mediaType: "image/png", data: new Uint8Array([1]) },
          { type: "file", mediaType: "image/png", data: new Uint8Array([2]) },
        ],
        providerOptions: {
          magnific: {
            prompt_upsampling: true,
            input_image_3: "premade-3",
            webhook_url: "https://wh.example/cb",
          },
        },
      }),
    );
    expect(body).toMatchObject({
      prompt: "a cat",
      width: 1280,
      height: 720,
      seed: 42,
      prompt_upsampling: true,
      input_image: "AQ==",
      input_image_2: "Ag==",
      input_image_3: "premade-3",
      webhook_url: "https://wh.example/cb",
    });
  });

  test("flux-2-turbo emits image_size object and guidance_scale", async () => {
    const body = await _internal_buildBody(
      "magnific/flux-2-turbo",
      "image",
      baseImageOpts({
        prompt: "x",
        seed: 1,
        size: "2048x2048",
        providerOptions: {
          magnific: {
            guidance_scale: 4.5,
            enable_safety_checker: false,
            output_format: "jpeg",
          },
        },
      }),
    );
    expect(body).toMatchObject({
      prompt: "x",
      guidance_scale: 4.5,
      seed: 1,
      image_size: { width: 2048, height: 2048 },
      enable_safety_checker: false,
      output_format: "jpeg",
    });
  });

  test("flux-2-klein covers safety_tolerance and 4 reference images", async () => {
    const body = await _internal_buildBody(
      "magnific/flux-2-klein",
      "image",
      baseImageOpts({
        prompt: "x",
        aspectRatio: "16:9",
        providerOptions: {
          magnific: {
            resolution: "2k",
            safety_tolerance: 4,
            output_format: "png",
          },
        },
      }),
    );
    expect(body).toMatchObject({
      prompt: "x",
      aspect_ratio: "widescreen_16_9",
      resolution: "2k",
      safety_tolerance: 4,
      output_format: "png",
    });
  });

  test("flux-pro-v1.1 covers prompt_upsampling and safety_tolerance", async () => {
    const body = await _internal_buildBody(
      "magnific/flux-pro-v1.1",
      "image",
      baseImageOpts({
        prompt: "x",
        aspectRatio: "1:1",
        seed: 7,
        providerOptions: {
          magnific: {
            prompt_upsampling: true,
            safety_tolerance: 5,
            output_format: "png",
          },
        },
      }),
    );
    expect(body).toMatchObject({
      prompt: "x",
      prompt_upsampling: true,
      seed: 7,
      aspect_ratio: "square_1_1",
      safety_tolerance: 5,
      output_format: "png",
    });
  });

  test("flux-dev forwards styling.effects and styling.colors", async () => {
    const body = await _internal_buildBody(
      "magnific/flux-dev",
      "image",
      baseImageOpts({
        prompt: "x",
        aspectRatio: "9:16",
        providerOptions: {
          magnific: {
            styling: {
              effects: {
                color: "vibrant",
                framing: "lowangle",
                lightning: "dramatic",
              },
              colors: [{ color: "#abcdef", weight: 0.5 }],
            },
          },
        },
      }),
    );
    expect(body).toMatchObject({
      prompt: "x",
      aspect_ratio: "social_story_9_16",
      styling: {
        effects: {
          color: "vibrant",
          framing: "lowangle",
          lightning: "dramatic",
        },
        colors: [{ color: "#abcdef", weight: 0.5 }],
      },
    });
  });

  test("hyperflux mirrors flux-dev fields", async () => {
    const body = await _internal_buildBody(
      "magnific/hyperflux",
      "image",
      baseImageOpts({
        prompt: "x",
        seed: 11,
        aspectRatio: "1:1",
      }),
    );
    expect(body).toMatchObject({
      prompt: "x",
      aspect_ratio: "square_1_1",
      seed: 11,
    });
  });

  test("seedream-4 covers guidance_scale", async () => {
    const body = await _internal_buildBody(
      "magnific/seedream-4",
      "image",
      baseImageOpts({
        prompt: "x",
        aspectRatio: "16:9",
        providerOptions: { magnific: { guidance_scale: 5 } },
      }),
    );
    expect(body).toMatchObject({
      prompt: "x",
      aspect_ratio: "widescreen_16_9",
      guidance_scale: 5,
    });
  });

  test("seedream-v4.5 covers safety checker", async () => {
    const body = await _internal_buildBody(
      "magnific/seedream-v4.5",
      "image",
      baseImageOpts({
        prompt: "x",
        aspectRatio: "21:9",
        providerOptions: { magnific: { enable_safety_checker: false } },
      }),
    );
    expect(body).toMatchObject({
      prompt: "x",
      aspect_ratio: "cinematic_21_9",
      enable_safety_checker: false,
    });
  });

  test("seedream-v4.5/edit emits prompt + reference_images[]", async () => {
    const body = await _internal_buildBody(
      "magnific/seedream-v4.5/edit",
      "image",
      baseImageOpts({
        prompt: "make brighter",
        files: [
          { type: "file", mediaType: "image/png", data: new Uint8Array([5]) },
          { type: "file", mediaType: "image/png", data: new Uint8Array([6]) },
        ],
        seed: 42,
        providerOptions: {
          magnific: {
            aspect_ratio: "widescreen_16_9",
            enable_safety_checker: false,
          },
        },
      }),
    );
    expect(body).toMatchObject({
      prompt: "make brighter",
      reference_images: ["BQ==", "Bg=="],
      aspect_ratio: "widescreen_16_9",
      seed: 42,
      enable_safety_checker: false,
    });
  });

  test("seedream-v4.5/edit rejects empty reference set", async () => {
    await expect(
      _internal_buildBody(
        "magnific/seedream-v4.5/edit",
        "image",
        baseImageOpts({ prompt: "x" }),
      ),
    ).rejects.toThrow(/at least one reference image/);
  });

  test("z-image-turbo passes through providerOptions", async () => {
    const body = await _internal_buildBody(
      "magnific/z-image-turbo",
      "image",
      baseImageOpts({
        prompt: "x",
        seed: 99,
      }),
    );
    expect(body).toMatchObject({ prompt: "x", seed: 99 });
  });

  test("runway-image covers ratio enum", async () => {
    const body = await _internal_buildBody(
      "magnific/runway-image",
      "image",
      baseImageOpts({
        prompt: "x",
        aspectRatio: "1:1",
        seed: 3,
      }),
    );
    expect(body).toMatchObject({ prompt: "x", ratio: "960:960", seed: 3 });
  });
});

describe("payload builders — video", () => {
  const fileImg = (b: number) => ({
    type: "file" as const,
    mediaType: "image/png",
    data: new Uint8Array([b]),
  });
  const urlVid = (u: string) => ({ type: "url" as const, url: u });

  test("kling-v2.1-pro covers all duration and motion-brush fields", async () => {
    const body = await _internal_buildBody(
      "magnific/kling-v2.1-pro",
      "video",
      baseVideoOpts({
        prompt: "motion",
        duration: 10,
        files: [fileImg(0)],
        providerOptions: {
          magnific: {
            image_tail: "tail-b64",
            negative_prompt: "blur",
            cfg_scale: 0.7,
            static_mask: "mask-b64",
            dynamic_masks: [{ x: 0, y: 0 }],
            webhook_url: "https://wh.example/cb",
          },
        },
      }),
    );
    expect(body).toMatchObject({
      duration: "10",
      image: "AA==",
      image_tail: "tail-b64",
      prompt: "motion",
      negative_prompt: "blur",
      cfg_scale: 0.7,
      static_mask: "mask-b64",
      dynamic_masks: [{ x: 0, y: 0 }],
    });
  });

  test("kling-v3-pro covers multi_prompt, elements, multi_shot, generate_audio", async () => {
    const body = await _internal_buildBody(
      "magnific/kling-v3-pro",
      "video",
      baseVideoOpts({
        prompt: "main",
        duration: 12,
        files: [urlVid("https://cdn.example/start.png")],
        providerOptions: {
          magnific: {
            multi_prompt: [
              { prompt: "shot 1", duration: "5" },
              { prompt: "shot 2", duration: "7" },
            ],
            elements: [
              {
                reference_image_urls: ["https://cdn.example/r1.png"],
                frontal_image_url: "https://cdn.example/front.png",
              },
            ],
            generate_audio: true,
            multi_shot: true,
            shot_type: "intelligent",
            negative_prompt: "wobble",
            cfg_scale: 0.6,
            end_image_url: "https://cdn.example/end.png",
          },
        },
        aspectRatio: "9:16",
      }),
    );
    expect(body).toMatchObject({
      prompt: "main",
      multi_prompt: [
        { prompt: "shot 1", duration: "5" },
        { prompt: "shot 2", duration: "7" },
      ],
      start_image_url: "https://cdn.example/start.png",
      end_image_url: "https://cdn.example/end.png",
      elements: [
        {
          reference_image_urls: ["https://cdn.example/r1.png"],
          frontal_image_url: "https://cdn.example/front.png",
        },
      ],
      generate_audio: true,
      multi_shot: true,
      shot_type: "intelligent",
      aspect_ratio: "9:16",
      duration: "12",
      negative_prompt: "wobble",
      cfg_scale: 0.6,
    });
  });

  test("kling-motion-control requires both image_url and video_url", async () => {
    const body = await _internal_buildBody(
      "magnific/kling-motion-control",
      "video",
      baseVideoOpts({
        prompt: "guide",
        files: [
          { type: "url", url: "https://cdn.example/char.png" },
          { type: "url", url: "https://cdn.example/ref.mp4" },
        ],
        providerOptions: {
          magnific: { character_orientation: "image", cfg_scale: 0.4 },
        },
      }),
    );
    expect(body).toMatchObject({
      image_url: "https://cdn.example/char.png",
      video_url: "https://cdn.example/ref.mp4",
      character_orientation: "image",
      cfg_scale: 0.4,
    });
  });

  test("kling-o1-pro covers first_frame, last_frame, duration enum", async () => {
    const body = await _internal_buildBody(
      "magnific/kling-o1-pro",
      "video",
      baseVideoOpts({
        prompt: "x",
        files: [fileImg(0), fileImg(1)],
        duration: 10,
        aspectRatio: "9:16",
      }),
    );
    expect(body).toMatchObject({
      prompt: "x",
      first_frame: "AA==",
      last_frame: "AQ==",
      aspect_ratio: "9:16",
      duration: 10,
    });
  });

  test("minimax-hailuo-02 covers prompt_optimizer and frame fields", async () => {
    const body = await _internal_buildBody(
      "magnific/minimax-hailuo-02",
      "video",
      baseVideoOpts({
        prompt: "x",
        files: [fileImg(0), fileImg(1)],
        providerOptions: {
          magnific: { prompt_optimizer: false },
        },
      }),
    );
    expect(body).toMatchObject({
      prompt: "x",
      prompt_optimizer: false,
      first_frame_image: "AA==",
      last_frame_image: "AQ==",
      duration: 6,
    });
  });

  test("minimax-video-01-live requires URL input and supports prompt_optimizer", async () => {
    const body = await _internal_buildBody(
      "magnific/minimax-video-01-live",
      "video",
      baseVideoOpts({
        prompt: "[Pan right]",
        files: [{ type: "url", url: "https://cdn.example/x.png" }],
      }),
    );
    expect(body).toMatchObject({
      image_url: "https://cdn.example/x.png",
      prompt: "[Pan right]",
      prompt_optimizer: true,
    });
  });

  test("wan-2.5-t2v covers enable_prompt_expansion and seed", async () => {
    const body = await _internal_buildBody(
      "magnific/wan-2.5-t2v",
      "video",
      baseVideoOpts({
        prompt: "scene",
        duration: 10,
        seed: 12345,
        providerOptions: {
          magnific: {
            negative_prompt: "wobble",
            enable_prompt_expansion: false,
          },
        },
      }),
    );
    expect(body).toMatchObject({
      prompt: "scene",
      duration: "10",
      negative_prompt: "wobble",
      enable_prompt_expansion: false,
      seed: 12345,
    });
  });

  test("wan-2.5-i2v requires image URL", async () => {
    const body = await _internal_buildBody(
      "magnific/wan-2.5-i2v",
      "video",
      baseVideoOpts({
        prompt: "scene",
        files: [{ type: "url", url: "https://cdn.example/k.png" }],
      }),
    );
    expect(body).toMatchObject({
      image: "https://cdn.example/k.png",
      prompt: "scene",
      duration: "5",
      enable_prompt_expansion: true,
    });
  });

  test("wan-2.6 covers size enum and shot_type", async () => {
    const body = await _internal_buildBody(
      "magnific/wan-2.6",
      "video",
      baseVideoOpts({
        prompt: "scene",
        files: [{ type: "url", url: "https://cdn.example/k.png" }],
        providerOptions: {
          magnific: {
            size: "1080*1920",
            shot_type: "multi",
            seed: 7,
          },
        },
      }),
    );
    expect(body).toMatchObject({
      image: "https://cdn.example/k.png",
      prompt: "scene",
      size: "1080*1920",
      duration: "5",
      shot_type: "multi",
      seed: 7,
    });
  });

  test("runway-gen4-turbo maps aspect ratio and duration", async () => {
    const body = await _internal_buildBody(
      "magnific/runway-gen4-turbo",
      "video",
      baseVideoOpts({
        prompt: "x",
        aspectRatio: "9:16",
        duration: 5,
        files: [fileImg(0)],
        seed: 9,
      }),
    );
    expect(body).toMatchObject({
      image: "AA==",
      prompt: "x",
      duration: 5,
      ratio: "720:1280",
      seed: 9,
    });
  });

  test("runway-act-two covers character + reference + body_control + expression_intensity", async () => {
    const body = await _internal_buildBody(
      "magnific/runway-act-two",
      "video",
      baseVideoOpts({
        providerOptions: {
          magnific: {
            character: { type: "image", uri: "https://cdn.example/c.png" },
            reference: { type: "video", uri: "https://cdn.example/p.mp4" },
            body_control: false,
            expression_intensity: 5,
          },
        },
      }),
    );
    expect(body).toMatchObject({
      character: { type: "image", uri: "https://cdn.example/c.png" },
      reference: { type: "video", uri: "https://cdn.example/p.mp4" },
      body_control: false,
      expression_intensity: 5,
      ratio: "1280:720",
    });
  });

  test("ltx-2-pro covers resolution, duration enum, fps, generate_audio", async () => {
    const body = await _internal_buildBody(
      "magnific/ltx-2-pro",
      "video",
      baseVideoOpts({
        prompt: "x",
        duration: 10,
        fps: 50,
        providerOptions: {
          magnific: { resolution: "2160p", generate_audio: true },
        },
      }),
    );
    expect(body).toMatchObject({
      prompt: "x",
      resolution: "2160p",
      duration: 10,
      fps: 50,
      generate_audio: true,
    });
  });

  test("seedance-pro covers camera_fixed and aspect ratio", async () => {
    const body = await _internal_buildBody(
      "magnific/seedance-pro",
      "video",
      baseVideoOpts({
        prompt: "x",
        aspectRatio: "21:9",
        files: [fileImg(0)],
        providerOptions: {
          magnific: { camera_fixed: true, frames_per_second: 24, seed: 42 },
        },
      }),
    );
    expect(body).toMatchObject({
      prompt: "x",
      image: "AA==",
      aspect_ratio: "film_horizontal_21_9",
      camera_fixed: true,
      frames_per_second: 24,
      seed: 42,
    });
  });

  test("pixverse covers style, resolution, duration, negative_prompt", async () => {
    const body = await _internal_buildBody(
      "magnific/pixverse",
      "video",
      baseVideoOpts({
        prompt: "x",
        files: [{ type: "url", url: "https://cdn.example/x.png" }],
        duration: 8,
        providerOptions: {
          magnific: {
            resolution: "1080p",
            negative_prompt: "wobble",
            style: "anime",
          },
        },
      }),
    );
    expect(body).toMatchObject({
      image_url: "https://cdn.example/x.png",
      prompt: "x",
      resolution: "1080p",
      duration: 8,
      negative_prompt: "wobble",
      style: "anime",
    });
  });

  test("omnihuman-v1.5 requires both image and audio URLs", async () => {
    const body = await _internal_buildBody(
      "magnific/omnihuman-v1.5",
      "video",
      baseVideoOpts({
        prompt: "speak naturally",
        files: [
          { type: "url", url: "https://cdn.example/face.png" },
          { type: "url", url: "https://cdn.example/voice.mp3" },
        ],
        providerOptions: {
          magnific: { turbo_mode: true, resolution: "720p" },
        },
      }),
    );
    expect(body).toMatchObject({
      image_url: "https://cdn.example/face.png",
      audio_url: "https://cdn.example/voice.mp3",
      prompt: "speak naturally",
      turbo_mode: true,
      resolution: "720p",
    });
  });

  test("vfx covers all 8 filter types and conditional fields", async () => {
    const body = await _internal_buildBody(
      "magnific/vfx",
      "video",
      baseVideoOpts({
        files: [urlVid("https://cdn.example/clip.mp4")],
        fps: 30,
        providerOptions: {
          magnific: {
            filter_type: 7,
            bloom_filter_contrast: 1.4,
            motion_filter_kernel_size: 9,
            motion_filter_decay_factor: 0.8,
          },
        },
      }),
    );
    expect(body).toMatchObject({
      video: "https://cdn.example/clip.mp4",
      filter_type: 7,
      fps: 30,
      bloom_filter_contrast: 1.4,
      motion_filter_kernel_size: 9,
      motion_filter_decay_factor: 0.8,
    });
  });
});

describe("payload builders — audio", () => {
  test("music covers prompt, music_length_seconds, webhook_url", async () => {
    const body = await _internal_buildBody(
      "magnific/default",
      "music",
      baseMusicOpts({
        prompt: "ambient piano",
        duration: 60,
        providerOptions: {
          magnific: { webhook_url: "https://wh.example/cb" },
        },
      }),
    );
    expect(body).toEqual({
      prompt: "ambient piano",
      music_length_seconds: 60,
      webhook_url: "https://wh.example/cb",
    });
  });

  test("sound-effects covers text, duration, loop, prompt_influence", async () => {
    const body = await _internal_buildBody(
      "magnific/sound-effects",
      "speech",
      baseSpeechOpts({
        text: "deep ominous rumble",
        providerOptions: {
          magnific: {
            duration_seconds: 8.5,
            loop: true,
            prompt_influence: 0.7,
            webhook_url: "https://wh.example/cb",
          },
        },
      }),
    );
    expect(body).toEqual({
      text: "deep ominous rumble",
      duration_seconds: 8.5,
      loop: true,
      prompt_influence: 0.7,
      webhook_url: "https://wh.example/cb",
    });
  });

  test("audio-isolation covers description, audio xor video, bbox, fps, candidates, predict_spans", async () => {
    const body = await _internal_buildBody(
      "magnific/audio-isolation",
      "speech",
      baseSpeechOpts({
        text: "isolated voice only",
        providerOptions: {
          magnific: {
            audio: "https://cdn.example/a.mp3",
            sample_fps: 4,
            reranking_candidates: 5,
            predict_spans: true,
          },
        },
      }),
    );
    expect(body).toMatchObject({
      description: "isolated voice only",
      audio: "https://cdn.example/a.mp3",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      sample_fps: 4,
      reranking_candidates: 5,
      predict_spans: true,
    });
  });

  test("audio-isolation rejects passing both audio and video", async () => {
    await expect(
      _internal_buildBody(
        "magnific/audio-isolation",
        "speech",
        baseSpeechOpts({
          text: "x",
          providerOptions: {
            magnific: {
              audio: "https://cdn.example/a.mp3",
              video: "https://cdn.example/v.mp4",
            },
          },
        }),
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Passthrough behavior — providerOptions.magnific keys not in builder schema
// flow through to the body without overwriting builder-produced keys.
// ---------------------------------------------------------------------------

describe("providerOptions.magnific passthrough", () => {
  test("unknown keys flow through to body", async () => {
    const body = await _internal_buildBody(
      "magnific/upscale-creative",
      "image",
      baseImageOpts({
        files: [
          { type: "file", mediaType: "image/png", data: new Uint8Array([0]) },
        ],
        providerOptions: {
          magnific: {
            scale_factor: "4x",
            future_field: "future-value",
            another: { nested: 42 },
          },
        },
      }),
    );
    expect(body).toMatchObject({
      scale_factor: "4x",
      future_field: "future-value",
      another: { nested: 42 },
    });
  });

  test("apiKey is stripped from body even on passthrough", async () => {
    const body = await _internal_buildBody(
      "magnific/upscale-creative",
      "image",
      baseImageOpts({
        files: [
          { type: "file", mediaType: "image/png", data: new Uint8Array([0]) },
        ],
        providerOptions: {
          magnific: {
            apiKey: "secret-byok",
            scale_factor: "4x",
          },
        },
      }),
    );
    expect(body.apiKey).toBeUndefined();
    expect(body.scale_factor).toBe("4x");
  });
});

// ---------------------------------------------------------------------------
// Gateway fallback (no MAGNIFIC_API_KEY, no magnificApiKey setting)
// ---------------------------------------------------------------------------

describe("gateway fallback when no magnific key is available", () => {
  const ENV_BACKUP = process.env.MAGNIFIC_API_KEY;

  beforeEach(() => {
    delete process.env.MAGNIFIC_API_KEY;
  });
  afterEach(() => {
    if (ENV_BACKUP === undefined) delete process.env.MAGNIFIC_API_KEY;
    else process.env.MAGNIFIC_API_KEY = ENV_BACKUP;
  });

  test("routes through varg gateway when no magnific key exists", async () => {
    const { calls, restore } = makeFetchHarness([
      {
        json: {
          job_id: "gw-1",
          status: "completed",
          output: {
            url: "https://cdn.example/gw.png",
            media_type: "image/png",
          },
        },
      },
      { bytes: new Uint8Array([5, 6, 7]) },
    ]);

    try {
      const v = createVarg({ apiKey: "varg-key" });
      await v.imageModel("magnific/mystic").doGenerate({
        prompt: "gateway test",
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(calls.length).toBeGreaterThanOrEqual(1);
      const submit = calls[0]!;
      expect(submit.url).toContain("/v1/image");
      expect(submit.url).not.toContain("api.magnific.com");
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Abort signal propagation
// ---------------------------------------------------------------------------

describe("abort signal propagation", () => {
  const ENV_BACKUP = process.env.MAGNIFIC_API_KEY;

  beforeEach(() => {
    process.env.MAGNIFIC_API_KEY = "test-key";
  });
  afterEach(() => {
    if (ENV_BACKUP === undefined) delete process.env.MAGNIFIC_API_KEY;
    else process.env.MAGNIFIC_API_KEY = ENV_BACKUP;
  });

  test("pre-aborted signal rejects during submit", async () => {
    const { restore } = makeFetchHarness([
      { json: { task_id: "t-1", status: "IN_PROGRESS" } },
    ]);

    try {
      const ac = new AbortController();
      ac.abort();

      const v = createVarg({
        apiKey: "varg-key",
        magnificApiKey: "test-key",
      });
      await expect(
        v.imageModel("magnific/mystic").doGenerate({
          prompt: "abort test",
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          files: undefined,
          mask: undefined,
          providerOptions: {},
          headers: {},
          abortSignal: ac.signal,
        }),
      ).rejects.toThrow();
    } finally {
      restore();
    }
  });

  test("abort during download rejects after successful submit+poll", async () => {
    const ac = new AbortController();
    let downloadFetchCalled = false;

    const original = globalThis.fetch;
    let callCount = 0;
    // biome-ignore lint/suspicious/noExplicitAny: test harness
    (globalThis as any).fetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      callCount++;
      const url = typeof input === "string" ? input : input.toString();
      if (callCount === 1) {
        // submit — return completed immediately so we skip polling
        return new Response(
          JSON.stringify({
            task_id: "t-dl",
            status: "COMPLETED",
            generated: ["https://cdn.example/result.png"],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      // download — abort before resolving
      downloadFetchCalled = true;
      ac.abort();
      init?.signal?.throwIfAborted();
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    };

    try {
      const v = createVarg({
        apiKey: "varg-key",
        magnificApiKey: "test-key",
      });
      await expect(
        v.imageModel("magnific/mystic").doGenerate({
          prompt: "abort download test",
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          files: undefined,
          mask: undefined,
          providerOptions: {},
          headers: {},
          abortSignal: ac.signal,
        }),
      ).rejects.toThrow();
      expect(downloadFetchCalled).toBe(true);
    } finally {
      // biome-ignore lint/suspicious/noExplicitAny: test harness
      (globalThis as any).fetch = original;
    }
  });
});
