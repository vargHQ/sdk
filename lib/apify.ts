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

// cli runner
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "run": {
      if (!args[0]) {
        console.log(`
usage: bun run lib/apify.ts run <actor_id> [input_json]

examples:
  bun run lib/apify.ts run apify/web-scraper '{"startUrls":[{"url":"https://example.com"}]}'
  bun run lib/apify.ts run apify/google-search-scraper '{"queries":"openai"}'
        `);
        process.exit(1);
      }
      const input = args[1] ? JSON.parse(args[1]) : undefined;
      const result = await runActor({
        actorId: args[0],
        input,
      });
      console.log(JSON.stringify(result, null, 2));
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

    default:
      console.log(`
usage:
  bun run lib/apify.ts run <actor_id> [input_json]    - run an actor and get results
  bun run lib/apify.ts dataset <dataset_id>          - get items from a dataset
  bun run lib/apify.ts status <run_id>               - get run status
  bun run lib/apify.ts wait <run_id>                 - wait for run to finish

environment:
  APIFY_TOKEN - your apify api token (required)
      `);
      process.exit(1);
  }
}
