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
      <box style={{ paddingLeft: 2 }}>
        <VargText variant="muted">no items</VargText>
      </box>
    );
  }

  const maxNameWidth = Math.max(...rows.map((r) => r.name.length), 12);

  return (
    <box style={{ flexDirection: "column" }}>
      {rows.map((row) => (
        <box key={row.name} style={{ paddingLeft: 2 }}>
          {showType && row.type && (
            <>
              <Badge type={row.type} />
              <text> </text>
            </>
          )}
          <text>
            <strong>{row.name.padEnd(maxNameWidth)}</strong>
          </text>
          <VargText variant="muted"> {row.description}</VargText>
        </box>
      ))}
    </box>
  );
}

export default DataTable;
