/**
 * Citty ↔ OpenTUI Bridge
 * Helpers to render OpenTUI React components from citty commands
 */

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import type { ReactNode } from "react";

// Shared renderer instance (lazy initialized)
let sharedRenderer: Awaited<ReturnType<typeof createCliRenderer>> | null = null;

async function getRenderer() {
  if (!sharedRenderer) {
    sharedRenderer = await createCliRenderer({
      exitOnCtrlC: true,
      useAlternateScreen: false,
    });
  }
  return sharedRenderer;
}

/**
 * Render a static component that auto-exits after mounting
 * Use for: list, help, which, find commands
 */
export async function renderStatic(element: ReactNode): Promise<void> {
  const renderer = await getRenderer();
  const root = createRoot(renderer);
  root.render(element);

  // Give React time to render, then destroy
  await new Promise((resolve) => setTimeout(resolve, 50));
  renderer.destroy();
  sharedRenderer = null;
}

/**
 * Render a component with live updates
 * Use for: run command with spinner/progress
 * Returns control handle for manual rerender and unmount
 */
export async function renderLive(element: ReactNode) {
  const renderer = await getRenderer();
  const root = createRoot(renderer);
  root.render(element);

  return {
    rerender: (newElement: ReactNode) => {
      root.render(newElement);
    },
    unmount: () => {
      renderer.destroy();
      sharedRenderer = null;
    },
  };
}

/**
 * Render and wait for component to signal exit
 * Use for: interactive components (future)
 */
export async function renderAndWait(element: ReactNode): Promise<void> {
  const renderer = await getRenderer();
  const root = createRoot(renderer);
  root.render(element);

  // Wait until process exits or user presses Ctrl+C
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      renderer.destroy();
      sharedRenderer = null;
      resolve();
    });
  });
}
