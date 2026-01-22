/** @jsxImportSource react */
/**
 * StatusBox - Execution status display
 * Shows running/done/error state with params and results
 */

import { Box, Text } from "ink";
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
  progress?: number; // 0-100, shows progress bar when provided
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
      {/* Status indicator */}
      <Box marginY={1}>
        {status === "running" ? (
          <VargSpinner label={config.label} />
        ) : (
          <Text color={config.color}>
            {config.icon} {config.label}
          </Text>
        )}
      </Box>

      {/* Progress bar (when provided) */}
      {progress !== undefined && status === "running" && (
        <Box marginBottom={1}>
          <VargProgress value={progress} label="processing" />
        </Box>
      )}

      {/* Parameters */}
      {params && Object.keys(params).length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {Object.entries(params).map(([key, value]) => (
            <KeyValue key={key} label={key} value={value} />
          ))}
        </Box>
      )}

      {/* Output */}
      {output && (
        <Box marginTop={1}>
          <KeyValue label="output" value={output} />
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box marginTop={1}>
          <VargText variant="error">error: {error}</VargText>
        </Box>
      )}

      {/* Duration */}
      {duration !== undefined && (
        <KeyValue label="time" value={formatDuration(duration)} />
      )}
    </VargBox>
  );
}

export default StatusBox;
