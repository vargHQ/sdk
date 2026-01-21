export type GenerationType =
  | "image"
  | "video"
  | "animate"
  | "speech"
  | "music"
  | "editly"
  | "captions"
  | "transcribe";

export const TIME_ESTIMATES: Record<GenerationType, number> = {
  image: 30,
  video: 120,
  animate: 90,
  speech: 5,
  music: 45,
  editly: 15,
  captions: 10,
  transcribe: 15,
};

export const MODEL_TIME_ESTIMATES: Record<string, number> = {
  // image models - use partial matching
  "flux/schnell": 3,
  "flux/dev": 8,
  "flux-pro": 12,
  recraft: 10,
  ideogram: 8,
  // video models
  kling: 180,
  "kling-v2": 180,
  "kling-v2.5": 180,
  minimax: 90,
  luma: 90,
  runway: 45,
  veo: 120,
  // speech models
  elevenlabs: 5,
  eleven: 5,
  // music models
  "stable-audio": 30,
  musicgen: 45,
};

export interface ProgressTask {
  id: string;
  type: GenerationType;
  model: string;
  status: "pending" | "running" | "done";
  startedAt?: number;
  completedAt?: number;
}

export interface ProgressTracker {
  tasks: ProgressTask[];
  onUpdate?: (tracker: ProgressTracker) => void;
  quiet: boolean;
}

export function createProgressTracker(quiet = false): ProgressTracker {
  return {
    tasks: [],
    quiet,
  };
}

export function addTask(
  tracker: ProgressTracker,
  type: GenerationType,
  model: string,
): string {
  const id = `${type}-${tracker.tasks.length}`;
  tracker.tasks.push({ id, type, model, status: "pending" });
  return id;
}

export function startTask(tracker: ProgressTracker, id: string): void {
  const task = tracker.tasks.find((t) => t.id === id);
  if (task) {
    task.status = "running";
    task.startedAt = Date.now();
    if (!tracker.quiet) {
      logTaskStart(task);
    }
  }
  tracker.onUpdate?.(tracker);
}

const CACHE_THRESHOLD_MS = 1000;

export function completeTask(tracker: ProgressTracker, id: string): void {
  const task = tracker.tasks.find((t) => t.id === id);
  if (task) {
    task.status = "done";
    task.completedAt = Date.now();
    const duration = task.startedAt ? task.completedAt - task.startedAt : 0;
    const wasCached = duration < CACHE_THRESHOLD_MS;
    if (!tracker.quiet) {
      logTaskComplete(task, wasCached);
    }
  }
  tracker.onUpdate?.(tracker);
}

function getEstimate(task: ProgressTask): number {
  const modelLower = task.model.toLowerCase();
  for (const [key, estimate] of Object.entries(MODEL_TIME_ESTIMATES)) {
    if (modelLower.includes(key.toLowerCase())) {
      return estimate;
    }
  }
  return TIME_ESTIMATES[task.type];
}

function logTaskStart(task: ProgressTask): void {
  const estimate = getEstimate(task);
  console.log(`⏳ generating ${task.type} with ${task.model} (~${estimate}s)`);
}

function logTaskComplete(task: ProgressTask, cached: boolean): void {
  const duration =
    task.completedAt && task.startedAt
      ? ((task.completedAt - task.startedAt) / 1000).toFixed(1)
      : "?";
  if (cached) {
    console.log(`⚡ ${task.type} from cache`);
  } else {
    console.log(`✓ ${task.type} done (${duration}s)`);
  }
}

export function getTotalEstimate(tracker: ProgressTracker): number {
  return tracker.tasks.reduce((sum, task) => sum + getEstimate(task), 0);
}

export function getElapsedTime(tracker: ProgressTracker): number {
  const completed = tracker.tasks.filter((t) => t.status === "done");
  const running = tracker.tasks.find((t) => t.status === "running");

  let elapsed = 0;
  for (const task of completed) {
    if (task.startedAt && task.completedAt) {
      elapsed += (task.completedAt - task.startedAt) / 1000;
    }
  }
  if (running?.startedAt) {
    elapsed += (Date.now() - running.startedAt) / 1000;
  }
  return elapsed;
}

export function getProgress(tracker: ProgressTracker): number {
  const total = tracker.tasks.length;
  if (total === 0) return 0;
  const done = tracker.tasks.filter((t) => t.status === "done").length;
  return Math.round((done / total) * 100);
}

export function renderProgressBar(tracker: ProgressTracker): string {
  const progress = getProgress(tracker);
  const total = getTotalEstimate(tracker);
  const elapsed = getElapsedTime(tracker);

  const width = 30;
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);

  const done = tracker.tasks.filter((t) => t.status === "done").length;
  const totalTasks = tracker.tasks.length;

  return `[${bar}] ${progress}% (${done}/${totalTasks} tasks, ~${Math.round(total - elapsed)}s remaining)`;
}
