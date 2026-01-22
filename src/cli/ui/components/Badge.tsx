/** @jsxImportSource react */
/**
 * Badge - Type indicator badge
 * Shows [model] [action] [skill] with appropriate styling
 */

import { Text } from "ink";
import { theme } from "../theme.ts";

type BadgeType = "model" | "action" | "skill";

interface BadgeProps {
  type: BadgeType;
}

const badgeColors: Record<BadgeType, string> = {
  model: theme.colors.accent,
  action: theme.colors.success,
  skill: theme.colors.warning,
};

export function Badge({ type }: BadgeProps) {
  return (
    <Text color={badgeColors[type]} dimColor>
      [{type}]
    </Text>
  );
}

export default Badge;
