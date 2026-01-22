import { theme } from "../theme.ts";

interface SeparatorProps {
  width?: number;
}

export function Separator({
  width = theme.layout.maxWidth - 4,
}: SeparatorProps) {
  return (
    <box>
      <text fg="gray">{"─".repeat(width)}</text>
    </box>
  );
}

export default Separator;
