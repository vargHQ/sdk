/**
 * Separator - Horizontal divider line
 * Minimal visual separator between sections
 */

import { Box, Text } from "ink";
import { theme } from "../theme.ts";

interface SeparatorProps {
  width?: number;
}

export function Separator({
  width = theme.layout.maxWidth - 4,
}: SeparatorProps) {
  return (
    <Box>
      <Text dimColor>{"─".repeat(width)}</Text>
    </Box>
  );
}

export default Separator;
