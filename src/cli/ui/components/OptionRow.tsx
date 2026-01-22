/** @jsxImportSource react */
/**
 * OptionRow - CLI option display with better spacing
 * Shows option name, description, type hints, defaults, and enums
 */

import { Box, Text } from "ink";
import { theme } from "../theme.ts";

interface OptionRowProps {
  name: string;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  enumValues?: (string | number)[];
  type?: string;
  nameWidth?: number;
}

export function OptionRow({
  name,
  description,
  required = false,
  defaultValue,
  enumValues,
  type,
  nameWidth = theme.layout.optionNameWidth,
}: OptionRowProps) {
  const paddedName = `--${name}`.padEnd(nameWidth);
  const hasDefault = defaultValue !== undefined;
  const hasEnum = enumValues && enumValues.length > 0;

  // Format enum values - if many values, show abbreviated
  const formatEnums = (values: (string | number)[]) => {
    const stringValues = values.map(String);
    const joined = stringValues.join(", ");
    if (joined.length > 50) {
      // Show first few and count
      const shown = stringValues.slice(0, 4).join(", ");
      return `${shown}, ... (${values.length} options)`;
    }
    return joined;
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Main line: name + description + required */}
      <Box>
        <Text color={theme.colors.accent}>{paddedName}</Text>
        <Text>{description || ""}</Text>
        {required && <Text color={theme.colors.warning}> (required)</Text>}
      </Box>

      {/* Type and default on same line if compact */}
      {(type || hasDefault) && (
        <Box paddingLeft={nameWidth}>
          {type && (
            <Text dimColor>
              {"<"}
              {type}
              {">"}
            </Text>
          )}
          {hasDefault && (
            <Text dimColor>
              {type ? " " : ""}default: {String(defaultValue)}
            </Text>
          )}
        </Box>
      )}

      {/* Enum values on separate line for readability */}
      {hasEnum && (
        <Box paddingLeft={nameWidth}>
          <Text dimColor>[{formatEnums(enumValues)}]</Text>
        </Box>
      )}
    </Box>
  );
}

export default OptionRow;
