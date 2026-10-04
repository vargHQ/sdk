#!/usr/bin/env bun

/**
 * Benchmark for TSX file parsing into component tree
 *
 * This measures only the parsing speed (import + tree walk),
 * NOT the actual rendering/generation.
 */

import { resolve } from "node:path";

function countNodes(element: any): number {
  if (!element || typeof element !== "object" || !("type" in element)) {
    return 0;
  }

  let count = 1;

  if (element.children && Array.isArray(element.children)) {
    for (const child of element.children) {
      count += countNodes(child);
    }
  }

  if (element.props?.children) {
    if (Array.isArray(element.props.children)) {
      for (const child of element.props.children) {
        count += countNodes(child);
      }
    } else {
      count += countNodes(element.props.children);
    }
  }

  return count;
}

function getNodeTypes(
  element: any,
  types: Map<string, number> = new Map(),
): Map<string, number> {
  if (!element || typeof element !== "object" || !("type" in element)) {
    return types;
  }

  const typeKey =
    typeof element.type === "string"
      ? element.type
      : element.type?.name || "unknown";
  types.set(typeKey, (types.get(typeKey) || 0) + 1);

  if (element.children && Array.isArray(element.children)) {
    for (const child of element.children) {
      getNodeTypes(child, types);
    }
  }

  if (element.props?.children) {
    if (Array.isArray(element.props.children)) {
      for (const child of element.props.children) {
        getNodeTypes(child, types);
      }
    } else {
      getNodeTypes(element.props.children, types);
    }
  }

  return types;
}

async function benchmark(filePath: string, iterations = 50) {
  const absolutePath = resolve(filePath);
  console.log(`\n🔬 TSX Parsing Benchmark`);
  console.log(`File: ${filePath}`);
  console.log(`Iterations: ${iterations}\n`);

  const times: number[] = [];
  let component: any;

  // Warmup
  process.stdout.write("Warming up... ");
  for (let i = 0; i < 5; i++) {
    const { default: comp } = await import(`${absolutePath}?t=${Date.now()}`);
    component = comp;
  }
  console.log("✓\n");

  // Analyze structure (only once)
  const nodeCount = countNodes(component);
  const types = getNodeTypes(component);

  console.log(`Component structure:`);
  console.log(`  Total nodes: ${nodeCount}`);
  console.log(`  Node types:`);
  for (const [type, count] of [...types.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`    ${type}: ${count}`);
  }
  console.log();

  // Benchmark
  console.log("Running benchmark...\n");

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    // Import + parse
    const { default: comp } = await import(`${absolutePath}?t=${Date.now()}`);

    // Walk tree (simulate parsing)
    const _ = countNodes(comp);

    const end = performance.now();
    const time = end - start;
    times.push(time);

    if ((i + 1) % 10 === 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      process.stdout.write(
        `  Completed ${i + 1}/${iterations} runs (avg: ${avg.toFixed(3)}ms)\n`,
      );
    }
  }

  console.log();

  // Calculate statistics
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const sorted = [...times].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = Math.min(...times);
  const max = Math.max(...times);
  const std = Math.sqrt(
    times.reduce((sum, time) => sum + (time - avg) ** 2, 0) / times.length,
  );

  console.log("📊 Results:");
  console.log(`  Min:     ${min.toFixed(3)}ms`);
  console.log(`  P50:     ${p50.toFixed(3)}ms`);
  console.log(`  P95:     ${p95.toFixed(3)}ms`);
  console.log(`  P99:     ${p99.toFixed(3)}ms`);
  console.log(`  Max:     ${max.toFixed(3)}ms`);
  console.log(`  Average: ${avg.toFixed(3)}ms`);
  console.log(`  Std Dev: ${std.toFixed(3)}ms`);
  console.log();

  // Throughput
  const opsPerSec = 1000 / avg;
  console.log(`⚡ Performance:`);
  console.log(`  ${opsPerSec.toFixed(1)} parses/second`);
  console.log(`  ${avg.toFixed(3)}ms per parse`);
  console.log(`  ${(avg / nodeCount).toFixed(3)}ms per node`);
  console.log();
}

const file = process.argv[2] || "video.tsx";
const iterations = parseInt(process.argv[3] || "50", 10);

benchmark(file, iterations).catch(console.error);
