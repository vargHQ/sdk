/**
 * filesystem-based discovery for varg cli
 * scans action/ directory for modules with meta exports
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ActionMeta, Meta } from "./types";

const ACTION_DIR = join(import.meta.dir, "..", "action");

let cachedActions: ActionMeta[] | null = null;

export async function discoverActions(): Promise<ActionMeta[]> {
  if (cachedActions) return cachedActions;

  const actions: ActionMeta[] = [];
  const dirs = await readdir(ACTION_DIR);

  for (const dir of dirs) {
    try {
      const mod = await import(`../action/${dir}`);
      if (mod.meta && mod.meta.type === "action") {
        actions.push(mod.meta);
      }
    } catch {
      // skip directories without valid modules
    }
  }

  cachedActions = actions;
  return actions;
}

export async function resolve(name: string): Promise<Meta | null> {
  const actions = await discoverActions();

  // check explicit namespace
  if (name.startsWith("action/")) {
    const actionName = name.slice(7);
    return actions.find((a) => a.name === actionName) || null;
  }

  // check actions
  const action = actions.find((a) => a.name === name);
  if (action) return action;

  return null;
}

export async function search(query: string): Promise<Meta[]> {
  const actions = await discoverActions();
  const q = query.toLowerCase();

  return actions.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.inputType.toLowerCase().includes(q) ||
      a.outputType.toLowerCase().includes(q),
  );
}

export async function list(): Promise<Meta[]> {
  return discoverActions();
}
