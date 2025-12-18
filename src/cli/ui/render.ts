/**
 * Citty ↔ Ink Bridge
 * Helpers to render Ink components from citty commands
 */

import { render } from "ink";
import type { ReactElement } from "react";

/**
 * Render a static component that auto-exits after mounting
 * Use for: list, help, which, find commands
 */
export function renderStatic(element: ReactElement): void {
  const { unmount } = render(element);
  // Give React time to render, then unmount
  setTimeout(() => unmount(), 50);
}

/**
 * Render a component with live updates
 * Use for: run command with spinner/progress
 * Returns control handle for manual rerender and unmount
 */
export function renderLive(element: ReactElement) {
  return render(element);
}

/**
 * Render and wait for component to signal exit
 * Use for: interactive components (future)
 */
export async function renderAndWait(element: ReactElement): Promise<void> {
  const { waitUntilExit } = render(element);
  await waitUntilExit();
}
