import type {
  ImageModelV3,
  ImageModelV3CallOptions,
  SharedV3Warning,
} from "@ai-sdk/provider";

const IMAGE_MODELS = ["soul"] as const;
type ImageModelId = (typeof IMAGE_MODELS)[number];

/**
 * Available Soul styles for Higgsfield image generation.
 * Use with `higgsfield.imageModel("soul", { styleId: higgsfield.styles.REALISTIC })`
 */
export const SOUL_STYLES = {
  CREATURES: "b3c8075a-cb4c-42de-b8b3-7099dd2df672",
  MEDIEVAL: "1fc861ed-5923-41a6-9963-b9f04681dddd",
  SPOTLIGHT: "40ff999c-f576-443c-b5b3-c7d1391a666e",
  GIANT_PEOPLE: "a5f63c3b-70eb-4979-af5e-98c7ee1e18e8",
  RED_BALLOON: "3de71b9e-3973-4828-b246-a34c606e25a7",
  GREEN_EDITORIAL: "91abc4fe-1cf8-4a77-8ade-d36d46699014",
  SUBWAY: "d2e8ba04-9935-4dee-8bc4-39ac789746fc",
  LIBRARY: "6fb3e1f5-d721-4523-ac38-9902f2b2b850",
  REALISTIC: "1cb4b936-77bf-4f9a-9039-f3d349a4cdbe",
  DIGITALCAM: "ca4e6ad3-3e93-4e03-81a0-d1722d2c128b",
  GRILLZ_SELFIE: "255f4045-d68b-42b1-9e4c-f49d3263a9d7",
  BLEACHED_BROWS: "cc099663-9621-422e-8626-c8ee68953a0c",
  SITTING_ON_THE_STREET: "7696fd45-6e67-47d7-b800-096ce21cd449",
  CROSSING_THE_STREET: "d3e2b71d-b24b-462e-bd96-12f7a22b5142",
  ANGEL_WINGS: "4c24b43b-1984-407a-a0ae-c514f29b7e66",
  DUPLICATE: "88126a43-86fb-4047-a2d6-c9146d6ca6ce",
  QUIET_LUXURY: "ff1ad8a2-94e7-4e70-a12f-e992ca9a0d36",
  FIREPROOF: "373420f7-489e-4a5d-930e-cc4ecfcc23cc",
  ELEVATOR_MIRROR: "524be50a-4388-4ff5-a843-a73d2dd7ef87",
  CAM_360: "294bb3ee-eaef-4d2a-93e3-164268803db4",
  GLITCH: "62355e77-7096-45ae-9bea-e7c5b88c3b70",
  FASHION_SHOW: "86fc814e-856a-4af0-98b0-d4da75d0030b",
  PIXELETED_FACE: "34c50302-83ff-487d-b3a9-e35e501d80a7",
  SUNBATHING: "bc00b419-f8ca-4887-a990-e2760c3cb761",
  PAPER_FACE: "7fa63380-64b7-48b1-b684-4c9ef37560a9",
  GRAIN_90S: "f5c094c7-4671-4d86-90d2-369c8fdbd7a5",
  GEOMINIMAL: "372cc37b-9add-4952-a415-53db3998139f",
  FOGGY_MORNING: "0fe8ad66-ff61-411f-9186-b392e140b18c",
  OVEREXPOSED: "d8a35238-ba42-48a0-a76a-186a97734b9d",
  SUNSET_BEACH: "26241c54-ed78-4ea7-b1bf-d881737c9feb",
  GIANT_ACCESSORY: "70fbb531-5ee2-492e-8c53-5dbd6923e8c2",
  RING_SELFIE: "9de8ed26-c8dd-413c-a5e3-47eec97bc243",
  STREET_VIEW: "a13917c7-02a4-450f-b007-e72d53151980",
  EDITORIAL_90S: "710f9073-f580-48dc-b5c3-9bbc7cbb7f37",
  RHYME_BLUES: "c7ea4e7a-c40c-498d-948c-1f6919631f60",
  CAM_2000S: "181b3796-008a-403b-b31e-a9b760219f17",
  CCTV: "07a85fb3-4407-4122-a4eb-42124e57734c",
  OUTFIT_05: "71fecd8c-6696-42df-b5eb-f69e4150ca01",
  AMALFI_SUMMER: "dab472a6-23f4-4cf8-98fe-f3e256f1b549",
  BIMBOCORE: "f96913e8-2fcf-4358-8545-75dd6c34c518",
  SELFIE_05: "8dd89de9-1cff-402e-88a8-580c29d91473",
  SAND: "ba3d7634-447e-455c-98e3-63705d5403b8",
  VINTAGE_PHOTOBOOTH: "83caff04-691c-468c-b4a0-fd6bbabe062b",
  AFTERPARTY_CAM: "5765d07d-1525-4d4d-ae06-9091e2bdac2d",
  BABYDOLL_MAKEUP: "b7c621b5-9d3c-46a3-8efb-4cdfbc592271",
  THROUGH_THE_GLASS: "1900111a-4ce8-42a7-9394-7367f0e0385c",
  GALLERY: "36061eb7-4907-4cba-afb1-47afcf699873",
  EATING_FOOD: "7df83cc9-1e13-4bd0-b6ff-1e6a456b9e5a",
  SWORDS_HILL: "5b6f467e-f509-4afe-a8db-4c07a6f3770d",
  OFFICE_BEACH: "e454956b-caf2-4913-a398-dbc03f1cbedf",
  HELP_ITS_TOO_BIG: "5ad23bca-4a4b-4316-8c59-b80d7709d8ee",
  JAPANDI: "0089e17c-d0f0-4d0c-b522-6d25c88a29fc",
  IPHONE: "1b798b54-03da-446a-93bf-12fcba1050d7",
  GORPCORE: "96758335-d1d1-42b7-9c21-5ac38c433485",
  INDIE_SLEAZE: "5a72fec7-a12e-43db-8ef3-1d193b4f7ab4",
  FAIRYCORE: "7f21e7bd-4df6-4cef-a9a9-9746bceaea1d",
  TUMBLR: "0367d609-dfa1-4a81-a983-b2b19ecd6480",
  AVANT_GARDE: "0c636e12-3411-4a65-8d86-67858caf2fa7",
  HAIRCLIPS: "ea6f4dc0-d6dd-4bdf-a8cf-94ed1db91ab2",
  BIRTHDAY_MESS: "2d47f079-c021-4b8e-b2c0-3b927a80fc31",
  CLOUDED_DREAM: "493bda5b-bb4b-46fe-9343-7d5e414534ef",
  Y2K_POSTERS: "cbefda85-0f76-49bd-82d7-9bcd65be00ca",
  TOKYO_DRIFT: "ce9a88c2-c962-45e2-abaa-c8979d48f8d5",
  OBJECT_MAKEUP: "b7908955-2868-4e35-87a0-35e50cb92e5d",
  GRAFFITI: "0b4dac9a-f73a-4e5b-a5a7-1a40ee40d6ac",
  SUNBURNT: "e439bd89-8176-4729-b6a4-a9977120507d",
  HALLWAY_NOIR: "a643a36a-85e6-4e3d-80db-13e4997203cc",
  FASHION_2000S: "facaafeb-4ab5-4384-92a1-b4086180e9ac",
  NIGHT_BEACH: "62ba1751-63af-4648-a11c-711ac64e216a",
  MOVIE: "811de7ab-7aaf-4a6b-b352-cdea6c34c8f1",
  LONG_LEGS: "12eda704-18e5-4783-aa0f-deba5296cc83",
  APHEX_TWIN: "5659c554-9367-4a27-8c66-333c072cbbc2",
  GENERAL: "464ea177-8d40-4940-8d9d-b438bab269c7",
  NAIL_CHECK: "4b66c2db-8166-4293-b1aa-5269c9effb07",
  COQUETTE_CORE: "bd78cfc6-9b92-4889-9347-f21dbf0a269c",
  MIXED_MEDIA: "2fcf02e2-919a-4642-8b31-d58bde5e6bd9",
  SELFCARE: "d24c016c-9fb1-47d0-9909-19f57a2830d4",
  GRUNGE: "ad9de607-3941-4540-81ea-ba978ef1550b",
  DOUBLE_TAKE: "2a1898d0-548f-4433-8503-5721157b93a1",
  ROOM_505: "673cf0d4-c193-4fa2-8ad3-b4db4611e3ae",
  FLIGHT_MODE: "3f90dc5b-f474-4259-95c4-d29fbd6be645",
  ESCALATOR: "bab6e4bd-9093-4bb5-a371-01ef6cbd58ad",
  BURGUNDY_SUIT: "84c23cef-7eda-4f8f-9931-e3e6af8192d9",
  FISHEYE: "cc4e7248-dcfe-4c93-b264-2ab418a7556b",
  SHOE_CHECK: "30458874-d9c0-4d5a-b2b7-597e0eee2404",
  RAINY_DAY: "53bdadfa-8eb6-4eaa-8923-ebece4faa91c",
  MT_FUJI: "de0118ba-7c27-49f7-9841-38abe2aae8e1",
  SEA_BREEZE: "71ac929c-4002-4640-9b65-cb06402844c6",
  INVERTETHEREAL: "82edba1e-b093-4484-a25e-9276e0454999",
  Y2K: "6b9e6b4d-325a-4a78-a0fb-a00ddf612380",
  TOKYO_STREETSTYLE: "99de6fc5-1177-49b9-b2e9-19e17d95bcaf",
  CHROME_EXIT: "5e01339d-745e-4bba-96f7-e8ce4af79f17",
  NIGHT_RIDER: "1fba888b-9ab0-447f-a6a4-9ce5251ec2a6",
  ARTWORK: "b9e2d7dc-78e6-4f7d-95dd-b62690e7b200",
  GLAZED_DOLL_SKIN_MAKEUP: "a2a42ada-75cc-42a9-be12-cb16c1dec2a8",
  MOUNT_VIEW: "3c975998-cb5b-4980-80fc-7977e4c60972",
  BLADE_RUNNER_2049: "53959c8a-4323-4b78-9888-e9f6fb0f6b98",
  BLACKOUT_FIT: "f8dac072-d11f-438a-b283-fd52fe8aa744",
  BIKE_MAFIA: "90df2935-3ded-477f-8253-1d67dd939cbe",
  STATIC_GLOW: "fb9cee2b-632f-4fd4-ae4f-4664deecc0f4",
  NICOTINE_GLOW: "5dbb6a20-0541-4f06-8352-a2408d8781dc",
  BRICK_SHADE: "f3968a4f-a125-4c16-8673-45ce9874520e",
  DMV: "923e4fb0-d4ea-480c-876d-ac7cad862b9d",
  FISH_EYE_TWIN: "d4775423-d214-4862-b061-47baa1978208",
  ITS_FRENCH: "79bfaa63-4e12-4ea2-8ada-7d4406eecece",
  COCKTAIL: "aed71142-673c-4908-a6a7-326d5252eb06",
} as const;

export interface HiggsfieldImageModelSettings {
  styleId?: string;
  quality?: "720p" | "1080p";
  enhancePrompt?: boolean;
}

// Maps aspect ratio to width_and_height for Soul API
const ASPECT_RATIO_TO_SIZE: Record<string, string> = {
  "1:1": "1536x1536",
  "16:9": "2048x1152",
  "9:16": "1152x2048",
  "4:3": "2048x1536",
  "3:4": "1536x2048",
};

class HiggsfieldImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "higgsfield";
  readonly modelId: string;
  readonly maxImagesPerCall = 4;

  private apiKey: string;
  private apiSecret: string;
  private baseURL: string;
  private modelSettings: HiggsfieldImageModelSettings;

  get settings(): HiggsfieldImageModelSettings {
    return this.modelSettings;
  }

  constructor(
    modelId: string,
    options: {
      apiKey?: string;
      apiSecret?: string;
      baseURL?: string;
    } & HiggsfieldImageModelSettings = {},
  ) {
    this.modelId = modelId;
    this.apiKey = options.apiKey ?? process.env.HIGGSFIELD_API_KEY ?? "";
    this.apiSecret = options.apiSecret ?? process.env.HIGGSFIELD_SECRET ?? "";
    this.baseURL = options.baseURL ?? "https://platform.higgsfield.ai";
    this.modelSettings = {
      styleId: options.styleId,
      quality: options.quality,
      enhancePrompt: options.enhancePrompt,
    };
  }

  async doGenerate(options: ImageModelV3CallOptions) {
    const { prompt, n, aspectRatio, seed, providerOptions, abortSignal } = options;
    const warnings: SharedV3Warning[] = [];

    // Map aspect ratio to width_and_height
    const widthAndHeight = aspectRatio
      ? (ASPECT_RATIO_TO_SIZE[aspectRatio] ?? "1536x1536")
      : "1536x1536";

    if (aspectRatio && !ASPECT_RATIO_TO_SIZE[aspectRatio]) {
      warnings.push({
        type: "unsupported",
        feature: "aspectRatio",
        details: `Aspect ratio ${aspectRatio} not supported. Using 1:1. Supported: 1:1, 16:9, 9:16, 4:3, 3:4.`,
      });
    }

    // Build params object - matching working implementation
    const params: Record<string, unknown> = {
      prompt,
      width_and_height: widthAndHeight,
      enhance_prompt: this.modelSettings.enhancePrompt ?? false,
      quality: this.modelSettings.quality ?? "1080p",
      batch_size: n && n <= 4 ? n : 1,
    };

    if (this.modelSettings.styleId) {
      params.style_id = this.modelSettings.styleId;
    }

    if (seed !== undefined) {
      params.seed = seed;
    }

    // Merge provider options
    const higgsfieldOptions = providerOptions?.higgsfield as
      | Record<string, unknown>
      | undefined;
    if (higgsfieldOptions) {
      for (const [key, value] of Object.entries(higgsfieldOptions)) {
        if (value !== undefined && value !== null) {
          params[key] = value;
        }
      }
    }

    // Request body wrapped in params
    const requestBody = { params };

    // Make request to /v1/text2image/soul
    const response = await fetch(`${this.baseURL}/v1/text2image/soul`, {
      method: "POST",
      headers: {
        "hf-api-key": this.apiKey,
        "hf-secret": this.apiSecret,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Higgsfield Soul API error (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as { id?: string };
    const jobId = data?.id;

    if (!jobId) {
      throw new Error("No job ID returned from Higgsfield Soul API");
    }

    // Poll for results
    const imageUrl = await this.pollForResult(jobId, abortSignal);

    // Download image
    const imageResponse = await fetch(imageUrl, { signal: abortSignal });
    const imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());

    return {
      images: [imageBuffer],
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }

  private async pollForResult(
    jobId: string,
    abortSignal?: AbortSignal,
  ): Promise<string> {
    const maxAttempts = 60;
    const pollInterval = 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${this.baseURL}/v1/job-sets/${jobId}`, {
        method: "GET",
        headers: {
          "hf-api-key": this.apiKey,
          "hf-secret": this.apiSecret,
          Accept: "application/json",
        },
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Higgsfield polling error (${response.status}): ${errorText}`,
        );
      }

      const jobSet = (await response.json()) as {
        jobs?: Array<{
          status?: string;
          results?: {
            min?: { url?: string };
            raw?: { url?: string };
          };
        }>;
      };

      // Check if jobs array exists and has at least one job
      if (
        !jobSet?.jobs ||
        !Array.isArray(jobSet.jobs) ||
        jobSet.jobs.length === 0
      ) {
        throw new Error("No jobs found in Higgsfield JobSet response");
      }

      const job = jobSet.jobs[0];
      const jobStatus = job?.status;

      if (jobStatus === "completed") {
        const results = job?.results;

        if (results) {
          // Try to get URL from results object
          const imageUrl = results.min?.url ?? results.raw?.url;

          if (imageUrl) {
            return imageUrl;
          }
        }

        throw new Error("No result URL found in completed Higgsfield job");
      }

      if (jobStatus === "failed") {
        throw new Error("Higgsfield job failed");
      }

      if (jobStatus === "nsfw") {
        throw new Error("Higgsfield job rejected due to NSFW content");
      }

      // Still processing, wait before next poll
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error("Higgsfield generation timed out after 5 minutes");
  }
}

export interface HiggsfieldProviderSettings {
  apiKey?: string;
  apiSecret?: string;
  baseURL?: string;
  defaultModelSettings?: HiggsfieldImageModelSettings;
}

export interface HiggsfieldProvider {
  imageModel(
    modelId: ImageModelId | (string & {}),
    settings?: HiggsfieldImageModelSettings,
  ): ImageModelV3;
  /** Available Soul styles for image generation */
  styles: typeof SOUL_STYLES;
}

export function createHiggsfield(
  settings: HiggsfieldProviderSettings = {},
): HiggsfieldProvider {
  return {
    imageModel(
      modelId: string,
      modelSettings?: HiggsfieldImageModelSettings,
    ): ImageModelV3 {
      return new HiggsfieldImageModel(modelId, {
        apiKey: settings.apiKey,
        apiSecret: settings.apiSecret,
        baseURL: settings.baseURL,
        ...settings.defaultModelSettings,
        ...modelSettings,
      });
    },
    styles: SOUL_STYLES,
  };
}

export const higgsfield = createHiggsfield();
