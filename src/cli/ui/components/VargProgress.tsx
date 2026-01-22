import { theme } from "../theme.ts";

interface VargProgressProps {
  value: number;
  width?: number;
  showPercentage?: boolean;
  label?: string;
}

export function VargProgress({
  value,
  width = 24,
  showPercentage = true,
  label,
}: VargProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const filled = Math.round((clampedValue / 100) * width);
  const empty = width - filled;

  return (
    <text>
      <span fg={theme.colors.accent}>{"█".repeat(filled)}</span>
      <span fg="gray">{"░".repeat(empty)}</span>
      {showPercentage && <span fg="gray"> {clampedValue}%</span>}
      {label && <span fg="gray"> {label}</span>}
    </text>
  );
}

export default VargProgress;
