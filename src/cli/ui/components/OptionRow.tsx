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

  const formatEnums = (values: (string | number)[]) => {
    const stringValues = values.map(String);
    const joined = stringValues.join(", ");
    if (joined.length > 50) {
      const shown = stringValues.slice(0, 4).join(", ");
      return `${shown}, ... (${values.length} options)`;
    }
    return joined;
  };

  return (
    <box style={{ flexDirection: "column", marginBottom: 1 }}>
      <box>
        <text fg={theme.colors.accent}>{paddedName}</text>
        <text>{description || ""}</text>
        {required && <text fg={theme.colors.warning}> (required)</text>}
      </box>

      {(type || hasDefault) && (
        <box style={{ paddingLeft: nameWidth }}>
          {type && (
            <text fg="gray">
              {"<"}
              {type}
              {">"}
            </text>
          )}
          {hasDefault && (
            <text fg="gray">
              {type ? " " : ""}default: {String(defaultValue)}
            </text>
          )}
        </box>
      )}

      {hasEnum && (
        <box style={{ paddingLeft: nameWidth }}>
          <text fg="gray">[{formatEnums(enumValues)}]</text>
        </box>
      )}
    </box>
  );
}

export default OptionRow;
