/**
 * VargBox - Container component
 * Luxury minimal styled box with optional title and borders
 */

import type { ReactNode } from "react";
import { theme } from "../theme.ts";

interface VargBoxProps {
  title?: string;
  subtitle?: string;
  variant?: "default" | "minimal" | "bordered";
  width?: number;
  children: ReactNode;
}

export function VargBox({
  title,
  subtitle,
  variant = "default",
  width = theme.layout.maxWidth,
  children,
}: VargBoxProps) {
  const showBorder =
    variant === "bordered" || (variant === "default" && !!title);

  return (
    <box
      style={{
        flexDirection: "column",
        width,
        paddingLeft: theme.layout.boxPadding,
        paddingRight: theme.layout.boxPadding,
        paddingTop: variant === "minimal" ? 0 : 1,
        paddingBottom: variant === "minimal" ? 0 : 1,
      }}
      border={showBorder}
      borderStyle={showBorder ? "rounded" : undefined}
    >
      {title && (
        <box style={{ marginBottom: 1 }}>
          <text>
            <strong>{title}</strong>
          </text>
          {subtitle && <text fg="gray"> {subtitle}</text>}
        </box>
      )}
      {children}
    </box>
  );
}

export default VargBox;
