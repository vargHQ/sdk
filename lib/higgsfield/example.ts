#!/usr/bin/env bun
/**
 * Example usage of the new Higgsfield HTTP API
 */

import {
  generateSoul,
  listSoulStyles,
  SoulClient,
  SoulSize,
  SoulQuality,
  BatchSize,
} from "./soul";

// Example 1: Simple generation
async function simpleGeneration() {
  console.log("=== Example 1: Simple Generation ===\n");

  const result = await generateSoul({
    prompt: "a serene mountain landscape at sunset",
    width_and_height: SoulSize.LANDSCAPE_1536x2048,
    quality: SoulQuality.HD,
    batch_size: BatchSize.SINGLE,
  });

  if (result.status === "completed" && result.images && result.images[0]) {
    console.log("✓ Generation successful!");
    console.log(`Image URL: ${result.images[0].url}`);
  } else {
    console.log(`✗ Generation ${result.status}`);
  }
}

// Example 2: List and use styles
async function generationWithStyle() {
  console.log("\n=== Example 2: Generation with Style ===\n");

  // First, list available styles
  const styles = await listSoulStyles();
  console.log(`Found ${styles.length} available styles`);

  if (styles.length > 0) {
    const firstStyle = styles[0];
    if (firstStyle) {
      console.log(`Using style: ${firstStyle.name} (${firstStyle.id})`);

      const result = await generateSoul({
        prompt: "portrait of a wise old wizard",
        style_id: firstStyle.id,
        quality: SoulQuality.HD,
      });

      if (result.status === "completed" && result.images && result.images[0]) {
        console.log("✓ Generation with style successful!");
        console.log(`Image URL: ${result.images[0].url}`);
      }
    }
  }
}

// Example 3: Manual queue management
async function manualQueueManagement() {
  console.log("\n=== Example 3: Manual Queue Management ===\n");

  const client = new SoulClient();

  // Submit request
  const request = await client.submitRequest("soul", {
    prompt: "futuristic city skyline",
    quality: "1080p",
  });

  console.log(`Request submitted: ${request.request_id}`);
  console.log(`Status: ${request.status}`);

  // Poll for status updates
  const result = await client.waitForCompletion(request.request_id, {
    pollingInterval: 2000,
    maxWaitTime: 300000,
    onUpdate: (status) => {
      console.log(`  → ${status.status}`);
    },
  });

  if (result.status === "completed" && result.images && result.images[0]) {
    console.log("✓ Generation complete!");
    console.log(`Image URL: ${result.images[0].url}`);
  }
}

// Example 4: With webhook (for production)
async function generationWithWebhook() {
  console.log("\n=== Example 4: Generation with Webhook ===\n");

  const result = await generateSoul({
    prompt: "abstract art with vibrant colors",
    quality: SoulQuality.HD,
  });

  console.log("Request submitted - check status for completion");
  console.log(`Request ID: ${result.request_id}`);
  console.log(`Status URL: ${result.status_url}`);
}

// Example 5: Batch generation
async function batchGeneration() {
  console.log("\n=== Example 5: Batch Generation ===\n");

  const result = await generateSoul({
    prompt: "cute cartoon character designs",
    batch_size: BatchSize.FOUR,
    quality: SoulQuality.HD,
  });

  if (result.status === "completed" && result.images) {
    console.log(`✓ Generated ${result.images.length} images`);
    for (const [index, image] of result.images.entries()) {
      console.log(`  ${index + 1}. ${image.url}`);
    }
  }
}

// Example 6: Error handling
async function errorHandling() {
  console.log("\n=== Example 6: Error Handling ===\n");

  const client = new SoulClient();

  try {
    const result = await client.generateSoul({
      prompt: "test prompt",
      quality: SoulQuality.HD,
    });

    switch (result.status) {
      case "completed":
        console.log("✓ Success!");
        break;
      case "failed":
        console.log(`✗ Failed: ${result.error}`);
        break;
      case "nsfw":
        console.log("✗ Content flagged as NSFW (credits refunded)");
        break;
      case "canceled":
        console.log("✗ Request was canceled");
        break;
      default:
        console.log(`? Unexpected status: ${result.status}`);
    }
  } catch (error) {
    console.error("Error during generation:", error);
  }
}

// Run examples
if (import.meta.main) {
  const example = process.argv[2];

  try {
    switch (example) {
      case "1":
      case "simple":
        await simpleGeneration();
        break;
      case "2":
      case "style":
        await generationWithStyle();
        break;
      case "3":
      case "queue":
        await manualQueueManagement();
        break;
      case "4":
      case "webhook":
        await generationWithWebhook();
        break;
      case "5":
      case "batch":
        await batchGeneration();
        break;
      case "6":
      case "error":
        await errorHandling();
        break;
      case "all":
        // Run all examples (except webhook)
        await simpleGeneration();
        await generationWithStyle();
        await manualQueueManagement();
        await batchGeneration();
        await errorHandling();
        break;
      default:
        console.log(`
Higgsfield API Examples

Usage:
  bun run lib/higgsfield/example.ts <example>

Available examples:
  1, simple     - Simple generation
  2, style      - Generation with style
  3, queue      - Manual queue management
  4, webhook    - Generation with webhook
  5, batch      - Batch generation (4 images)
  6, error      - Error handling
  all           - Run all examples

Examples:
  bun run lib/higgsfield/example.ts simple
  bun run lib/higgsfield/example.ts style
  bun run lib/higgsfield/example.ts all
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error("\nExample failed:", error);
    process.exit(1);
  }
}
