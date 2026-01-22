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
    <box>
      <text fg="gray">{paddedLabel}</text>
      {required && <text fg={theme.colors.warning}>* </text>}
      <text>{value}</text>
    </box>
  );
}

export default KeyValue;
