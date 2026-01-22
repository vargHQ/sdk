import { VargText } from "./VargText.tsx";

interface HelpBlockProps {
  usage?: string;
  examples?: Array<{ command: string; description?: string }>;
}

export function HelpBlock({ usage, examples }: HelpBlockProps) {
  return (
    <box style={{ flexDirection: "column" }}>
      {usage && (
        <box style={{ marginBottom: 1 }}>
          <VargText variant="muted">usage: </VargText>
          <VargText variant="accent">{usage}</VargText>
        </box>
      )}

      {examples && examples.length > 0 && (
        <box style={{ flexDirection: "column" }}>
          {examples.map((ex) => (
            <box
              key={ex.command}
              style={{ flexDirection: "column", marginBottom: 1 }}
            >
              {ex.description && (
                <box style={{ paddingLeft: 2 }}>
                  <text fg="gray"># {ex.description}</text>
                </box>
              )}
              <box style={{ paddingLeft: 2 }}>
                <VargText variant="accent">{ex.command}</VargText>
              </box>
            </box>
          ))}
        </box>
      )}
    </box>
  );
}

export default HelpBlock;
