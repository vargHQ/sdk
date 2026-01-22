/**
 * VargText - Typography component
 * Provides semantic text variants for consistent styling
 */

import type { ReactNode } from "react";
import { theme } from "../theme.ts";

export type TextVariant =
  | "body"
  | "label"
  | "code"
  | "muted"
  | "accent"
  | "success"
  | "error"
  | "warning";

interface VargTextProps {
  variant?: TextVariant;
  bold?: boolean;
  dimColor?: boolean;
  children: ReactNode;
}

const variantStyles: Record<
  TextVariant,
  { color?: string; dimColor?: boolean }
> = {
  body: {},
  label: { dimColor: true },
  code: { color: theme.colors.accent },
  muted: { dimColor: true },
  accent: { color: theme.colors.accent },
  success: { color: theme.colors.success },
  error: { color: theme.colors.error },
  warning: { color: theme.colors.warning },
};

export function VargText({
  variant = "body",
  bold,
  dimColor,
  children,
}: VargTextProps) {
  const style = variantStyles[variant];
  const isDim = dimColor ?? style.dimColor;
  const fg = isDim ? "gray" : style.color;

  if (bold) {
    return (
      <text>
        <strong fg={fg}>{children}</strong>
      </text>
    );
  }

  return <text fg={fg}>{children}</text>;
}

export default VargText;
