#!/usr/bin/env bun

/**
 * apify wrapper for running actors and retrieving results
 *
 * usage: bun run lib/apify.ts <command> <args>
 */

import { ApifyClient } from "apify-client";

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

const OUTPUT_DIR = "output";

/**
 * save results to a json file in output directory
 */
function saveResults(filename: string, data: unknown): string {
  const outputPath = `${OUTPUT_DIR}/${filename}`;
  Bun.write(outputPath, JSON.stringify(data, null, 2));
  console.log(`[apify] saved results to: ${outputPath}`);
  return outputPath;
}

interface RunActorArgs {
  actorId: string;
  input?: Record<string, unknown>;
  waitForFinish?: boolean;
}

/**
 * run an apify actor and optionally wait for results
 */
export async function runActor(args: RunActorArgs) {
  console.log(`[apify] running actor: ${args.actorId}`);

  const actor = client.actor(args.actorId);

  if (args.waitForFinish !== false) {
    // call() waits for the run to finish
    const run = await actor.call(args.input);
    console.log(`[apify] run completed: ${run.id}`);

    // get results from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(`[apify] retrieved ${items.length} items`);

    return { run, items };
  }

  // start() returns immediately
  const run = await actor.start(args.input);
  console.log(`[apify] run started: ${run.id}`);
  return { run };
}

/**
 * get results from a dataset
 */
export async function getDataset(datasetId: string) {
  console.log(`[apify] fetching dataset: ${datasetId}`);
  const { items } = await client.dataset(datasetId).listItems();
  console.log(`[apify] retrieved ${items.length} items`);
  return items;
}

/**
 * get run status and info
 */
export async function getRunInfo(runId: string) {
  console.log(`[apify] fetching run info: ${runId}`);
  const run = await client.run(runId).get();
  return run;
}

/**
 * wait for a run to finish
 */
export async function waitForRun(runId: string) {
  console.log(`[apify] waiting for run: ${runId}`);
  const run = await client.run(runId).waitForFinish();
  console.log(`[apify] run finished with status: ${run?.status}`);
  return run;
}

/**
 * get value from key-value store
 */
export async function getKeyValueStoreValue(storeId: string, key: string) {
  console.log(`[apify] fetching key "${key}" from store: ${storeId}`);
  const value = await client.keyValueStore(storeId).getRecord(key);
  return value;
}

/**
 * download videos from a saved json file using yt-dlp
 */
async function downloadVideosFromJson(jsonPath: string, outputDir?: string) {
  const fullJsonPath = jsonPath.startsWith(OUTPUT_DIR)
    ? jsonPath
    : `${OUTPUT_DIR}/${jsonPath}`;

  console.log(`[apify] reading videos from: ${fullJsonPath}`);

  const file = Bun.file(fullJsonPath);
  const data = (await file.json()) as Array<{ webVideoUrl?: string }>;

  const urls = data
    .map((item) => item.webVideoUrl)
    .filter((url): url is string => !!url);

  console.log(`[apify] found ${urls.length} video urls`);

  const downloadDir = outputDir || `${OUTPUT_DIR}/videos`;

  // create download dir if needed
  await Bun.$`mkdir -p ${downloadDir}`;

  for (const url of urls) {
    console.log(`[apify] downloading: ${url}`);
    try {
      await Bun.$`yt-dlp -o "${downloadDir}/%(id)s.%(ext)s" ${url}`;
      console.log(`[apify] downloaded successfully`);
    } catch (err) {
      console.error(`[apify] failed to download ${url}:`, err);
    }
  }

  console.log(`[apify] all downloads complete. saved to: ${downloadDir}`);
}

// cli runner
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "run": {
      if (!args[0]) {
        console.log(`
usage: bun run lib/apify.ts run <actor_id> [input_json] [output_file]

examples:
  bun run lib/apify.ts run apify/web-scraper '{"startUrls":[{"url":"https://example.com"}]}'
  bun run lib/apify.ts run clockworks/tiktok-scraper '{"hashtags":["viral"],"resultsPerPage":5}' tiktok-viral.json
        `);
        process.exit(1);
      }
      const input = args[1] ? JSON.parse(args[1]) : undefined;
      const outputFile = args[2];
      const result = await runActor({
        actorId: args[0],
        input,
      });
      if (outputFile) {
        saveResults(outputFile, result.items);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
      break;
    }

    case "dataset": {
      if (!args[0]) {
        console.log(`
usage: bun run lib/apify.ts dataset <dataset_id>

examples:
  bun run lib/apify.ts dataset abc123
        `);
        process.exit(1);
      }
      const items = await getDataset(args[0]);
      console.log(JSON.stringify(items, null, 2));
      break;
    }

    case "status": {
      if (!args[0]) {
        console.log(`
usage: bun run lib/apify.ts status <run_id>

examples:
  bun run lib/apify.ts status abc123
        `);
        process.exit(1);
      }
      const runInfo = await getRunInfo(args[0]);
      console.log(JSON.stringify(runInfo, null, 2));
      break;
    }

    case "wait": {
      if (!args[0]) {
        console.log(`
usage: bun run lib/apify.ts wait <run_id>

examples:
  bun run lib/apify.ts wait abc123
        `);
        process.exit(1);
      }
      const finishedRun = await waitForRun(args[0]);
      console.log(JSON.stringify(finishedRun, null, 2));
      break;
    }

    case "download": {
      if (!args[0]) {
        console.log(`
usage: bun run lib/apify.ts download <json_file> [output_dir]

downloads videos from a saved json file using yt-dlp

examples:
  bun run lib/apify.ts download tiktok-viral.json
  bun run lib/apify.ts download output/tiktok-viral.json output/my-videos
        `);
        process.exit(1);
      }
      await downloadVideosFromJson(args[0], args[1]);
      break;
    }

    default:
      console.log(`
usage:
  bun run lib/apify.ts run <actor_id> [input_json] [output_file]  - run actor, save to file
  bun run lib/apify.ts download <json_file> [output_dir]          - download videos from json
  bun run lib/apify.ts dataset <dataset_id>                       - get items from a dataset
  bun run lib/apify.ts status <run_id>                            - get run status
  bun run lib/apify.ts wait <run_id>                              - wait for run to finish

examples:
  bun run lib/apify.ts run clockworks/tiktok-scraper '{"hashtags":["viral"],"resultsPerPage":5}' tiktok-viral.json
  bun run lib/apify.ts download tiktok-viral.json

environment:
  APIFY_TOKEN - your apify api token (required)
      `);
      process.exit(1);
  }
}
