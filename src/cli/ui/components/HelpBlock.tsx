/** @jsxImportSource react */
/**
 * HelpBlock - Command help and examples
 * Displays usage patterns and command examples
 */

import { Box, Text } from "ink";
import { VargText } from "./VargText.tsx";

interface HelpBlockProps {
  usage?: string;
  examples?: Array<{ command: string; description?: string }>;
}

export function HelpBlock({ usage, examples }: HelpBlockProps) {
  return (
    <Box flexDirection="column">
      {usage && (
        <Box marginBottom={1}>
          <VargText variant="muted">usage: </VargText>
          <VargText variant="accent">{usage}</VargText>
        </Box>
      )}

      {examples && examples.length > 0 && (
        <Box flexDirection="column">
          {examples.map((ex) => (
            <Box key={ex.command} flexDirection="column" marginBottom={1}>
              {ex.description && (
                <Box paddingLeft={2}>
                  <Text dimColor># {ex.description}</Text>
                </Box>
              )}
              <Box paddingLeft={2}>
                <VargText variant="accent">{ex.command}</VargText>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default HelpBlock;
