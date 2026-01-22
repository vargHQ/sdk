import { icons, theme } from "../theme.ts";
import KeyValue from "./KeyValue.tsx";
import VargBox from "./VargBox.tsx";
import { VargProgress } from "./VargProgress.tsx";
import VargSpinner from "./VargSpinner.tsx";
import { VargText } from "./VargText.tsx";

type Status = "running" | "done" | "error";

interface StatusBoxProps {
  title: string;
  status: Status;
  params?: Record<string, string>;
  output?: string;
  error?: string;
  duration?: number;
  progress?: number;
}

const statusConfig: Record<
  Status,
  { icon: string; color: string; label: string }
> = {
  running: {
    icon: icons.running,
    color: theme.colors.accent,
    label: "running",
  },
  done: { icon: icons.success, color: theme.colors.success, label: "done" },
  error: { icon: icons.error, color: theme.colors.error, label: "error" },
};

function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

export function StatusBox({
  title,
  status,
  params,
  output,
  error,
  duration,
  progress,
}: StatusBoxProps) {
  const config = statusConfig[status];

  return (
    <VargBox title={title} variant="bordered">
      <box style={{ marginTop: 1, marginBottom: 1 }}>
        {status === "running" ? (
          <VargSpinner label={config.label} />
        ) : (
          <text fg={config.color}>
            {config.icon} {config.label}
          </text>
        )}
      </box>

      {progress !== undefined && status === "running" && (
        <box style={{ marginBottom: 1 }}>
          <VargProgress value={progress} label="processing" />
        </box>
      )}

      {params && Object.keys(params).length > 0 && (
        <box style={{ flexDirection: "column", marginBottom: 1 }}>
          {Object.entries(params).map(([key, value]) => (
            <KeyValue key={key} label={key} value={value} />
          ))}
        </box>
      )}

      {output && (
        <box style={{ marginTop: 1 }}>
          <KeyValue label="output" value={output} />
        </box>
      )}

      {error && (
        <box style={{ marginTop: 1 }}>
          <VargText variant="error">error: {error}</VargText>
        </box>
      )}

      {duration !== undefined && (
        <KeyValue label="time" value={formatDuration(duration)} />
      )}
    </VargBox>
  );
}

export default StatusBox;
