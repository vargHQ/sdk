export type GenerationType =
  | "image"
  | "video"
  | "animate"
  | "speech"
  | "music"
  | "editly";

export const TIME_ESTIMATES: Record<GenerationType, number> = {
  image: 5,
  video: 60,
  animate: 45,
  speech: 3,
  music: 30,
  editly: 10,
};

export const MODEL_TIME_ESTIMATES: Record<string, number> = {
  // image models
  "fal-ai/flux/schnell": 3,
  "fal-ai/flux/dev": 8,
  "fal-ai/flux-pro": 12,
  "fal-ai/flux-pro/v1.1": 12,
  "fal-ai/flux-pro/v1.1-ultra": 15,
  "fal-ai/recraft-v3": 10,
  "fal-ai/ideogram/v2": 8,
  "fal-ai/ideogram/v2/turbo": 5,
  // video models
  "fal-ai/kling-video/v1/standard/image-to-video": 120,
  "fal-ai/kling-video/v1/pro/image-to-video": 180,
  "fal-ai/kling-video/v1.5/pro/image-to-video": 180,
  "fal-ai/minimax/video-01/image-to-video": 90,
  "fal-ai/minimax/video-01-live/image-to-video": 60,
  "fal-ai/luma-dream-machine/image-to-video": 90,
  "fal-ai/runway-gen3/turbo/image-to-video": 45,
  "fal-ai/veo2": 120,
  // speech models
  "elevenlabs/eleven_multilingual_v2": 3,
  "elevenlabs/eleven_turbo_v2_5": 2,
  // music models
  "fal-ai/stable-audio": 30,
  "replicate/musicgen": 45,
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

export function completeTask(tracker: ProgressTracker, id: string): void {
  const task = tracker.tasks.find((t) => t.id === id);
  if (task) {
    task.status = "done";
    task.completedAt = Date.now();
    if (!tracker.quiet) {
      logTaskComplete(task);
    }
  }
  tracker.onUpdate?.(tracker);
}

function getEstimate(task: ProgressTask): number {
  return MODEL_TIME_ESTIMATES[task.model] ?? TIME_ESTIMATES[task.type];
}

function logTaskStart(task: ProgressTask): void {
  const estimate = getEstimate(task);
  console.log(`⏳ generating ${task.type} with ${task.model} (~${estimate}s)`);
}

function logTaskComplete(task: ProgressTask): void {
  const duration =
    task.completedAt && task.startedAt
      ? ((task.completedAt - task.startedAt) / 1000).toFixed(1)
      : "?";
  console.log(`✓ ${task.type} done (${duration}s)`);
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
