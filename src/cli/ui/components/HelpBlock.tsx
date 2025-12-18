/**
 * HelpBlock - Command help and examples
 * Displays usage patterns and command examples
 */

import { Box, Text } from "ink";
import { theme } from "../theme.ts";

interface HelpBlockProps {
  usage?: string;
  examples?: Array<{ command: string; description?: string }>;
}

export function HelpBlock({ usage, examples }: HelpBlockProps) {
  return (
    <Box flexDirection="column">
      {usage && (
        <Box marginBottom={1}>
          <Text dimColor>usage: </Text>
          <Text color={theme.colors.accent}>{usage}</Text>
        </Box>
      )}

      {examples && examples.length > 0 && (
        <Box flexDirection="column">
          {examples.map((ex) => (
            <Box key={ex.command} paddingLeft={2}>
              <Text color={theme.colors.accent}>{ex.command}</Text>
              {ex.description && <Text dimColor> {ex.description}</Text>}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default HelpBlock;
