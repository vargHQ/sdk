#!/usr/bin/env bun
/**
 * Test runner index
 *
 * Usage:
 *   bun run src/tests/unit.test.ts    - Run unit tests (no API needed)
 *   bun run src/tests/all.test.ts     - Run all tests (requires API keys)
 */

console.log(`
varg SDK Tests
==============

Available test files:

  bun run src/tests/unit.test.ts
    Unit tests that don't require API keys.
    Tests registry, resolver, validation, and definition structure.

  bun run src/tests/all.test.ts
    Comprehensive tests including live API calls.
    Requires API keys set in environment variables:
    - FAL_API_KEY (or FAL_KEY)
    - REPLICATE_API_TOKEN  
    - ELEVENLABS_API_KEY
    - GROQ_API_KEY
    - FIREWORKS_API_KEY
    - HIGGSFIELD_API_KEY / HF_API_KEY

Run specific test file with:
  bun run <test-file>

`);
