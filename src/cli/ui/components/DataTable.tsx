/**
 * DataTable - Table display component
 * Clean text-based table for listing items
 */

import { Box, Text } from "ink";
import { theme } from "../theme.ts";

interface TableRow {
  name: string;
  description: string;
  type?: "model" | "action" | "skill";
}

interface DataTableProps {
  rows: TableRow[];
  showType?: boolean;
}

const typeColors: Record<string, string> = {
  model: theme.colors.accent,
  action: theme.colors.success,
  skill: theme.colors.warning,
};

export function DataTable({ rows, showType = false }: DataTableProps) {
  if (rows.length === 0) {
    return (
      <Box paddingLeft={2}>
        <Text dimColor>no items</Text>
      </Box>
    );
  }

  // Calculate max name width for alignment
  const maxNameWidth = Math.max(...rows.map((r) => r.name.length), 12);

  return (
    <Box flexDirection="column">
      {rows.map((row) => (
        <Box key={row.name} paddingLeft={2}>
          <Text>
            {showType && row.type && (
              <Text color={typeColors[row.type]} dimColor>
                [{row.type}]{" "}
              </Text>
            )}
            <Text bold>{row.name.padEnd(maxNameWidth)}</Text>
            <Text dimColor> {row.description}</Text>
          </Text>
        </Box>
      ))}
    </Box>
  );
}

export default DataTable;
