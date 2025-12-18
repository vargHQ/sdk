/**
 * VargBox - Container component
 * Luxury minimal styled box with optional title and borders
 */

import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { theme } from "../theme.ts";

type BorderStyle = "single" | "double" | "round" | "bold" | "classic";

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
  const showBorder = variant === "bordered" || (variant === "default" && title);

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle={
        showBorder ? (theme.borders.style as BorderStyle) : undefined
      }
      borderColor={theme.colors.border}
      paddingX={theme.layout.boxPadding}
      paddingY={variant === "minimal" ? 0 : 1}
    >
      {title && (
        <Box marginBottom={1}>
          <Text bold>{title}</Text>
          {subtitle && <Text dimColor> {subtitle}</Text>}
        </Box>
      )}
      {children}
    </Box>
  );
}

export default VargBox;
