/**
 * KeyValue - Label-value pair display
 * Aligned key-value pairs with optional required marker
 */

import { Box, Text } from "ink";
import { theme } from "../theme.ts";

interface KeyValueProps {
  label: string;
  value: string;
  labelWidth?: number;
  required?: boolean;
}

export function KeyValue({
  label,
  value,
  labelWidth = theme.layout.optionNameWidth,
  required = false,
}: KeyValueProps) {
  const paddedLabel = label.padEnd(labelWidth);

  return (
    <Box>
      <Text dimColor>{paddedLabel}</Text>
      {required && <Text color={theme.colors.warning}>* </Text>}
      <Text>{value}</Text>
    </Box>
  );
}

export default KeyValue;
