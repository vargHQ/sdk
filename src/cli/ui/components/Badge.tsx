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
    <text fg={badgeColors[type]}>
      <span fg="gray">[{type}]</span>
    </text>
  );
}

export default Badge;
