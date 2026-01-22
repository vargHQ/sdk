/** @jsxImportSource react */
/**
 * DataTable - Table display component
 * Clean text-based table for listing items
 */

import { Box, Text } from "ink";
import { Badge } from "./Badge.tsx";
import { VargText } from "./VargText.tsx";

interface TableRow {
  name: string;
  description: string;
  type?: "model" | "action" | "skill";
}

interface DataTableProps {
  rows: TableRow[];
  showType?: boolean;
}

export function DataTable({ rows, showType = false }: DataTableProps) {
  if (rows.length === 0) {
    return (
      <Box paddingLeft={2}>
        <VargText variant="muted">no items</VargText>
      </Box>
    );
  }

  // Calculate max name width for alignment
  const maxNameWidth = Math.max(...rows.map((r) => r.name.length), 12);

  return (
    <Box flexDirection="column">
      {rows.map((row) => (
        <Box key={row.name} paddingLeft={2}>
          {showType && row.type && (
            <>
              <Badge type={row.type} />
              <Text> </Text>
            </>
          )}
          <Text bold>{row.name.padEnd(maxNameWidth)}</Text>
          <VargText variant="muted"> {row.description}</VargText>
        </Box>
      ))}
    </Box>
  );
}

export default DataTable;
