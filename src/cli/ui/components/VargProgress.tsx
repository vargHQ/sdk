/**
 * VargProgress - Progress bar component
 * Elegant thin progress visualization
 */

import { Text } from "ink";
import { theme } from "../theme.ts";

interface VargProgressProps {
  value: number; // 0-100
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
    <Text>
      <Text color={theme.colors.accent}>{"█".repeat(filled)}</Text>
      <Text dimColor>{"░".repeat(empty)}</Text>
      {showPercentage && <Text dimColor> {clampedValue}%</Text>}
      {label && <Text dimColor> {label}</Text>}
    </Text>
  );
}

export default VargProgress;
