/**
 * varg find command
 * Ink-based search view
 */

import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { registry } from "../../core/registry/index.ts";
import { DataTable, VargBox } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";
import { theme } from "../ui/theme.ts";

interface FindViewProps {
  query: string;
  results: Array<{ name: string; description: string; type: string }>;
}

function FindView({ query, results }: FindViewProps) {
  return (
    <VargBox title={`search: ${query}`}>
      <DataTable
        rows={results.map((r) => ({
          name: r.name,
          description: r.description,
          type: r.type as "model" | "action" | "skill",
        }))}
        showType
      />
      <Box marginTop={1}>
        <Text dimColor>
          {results.length} result{results.length > 1 ? "s" : ""}
        </Text>
      </Box>
    </VargBox>
  );
}

function NoResultsView({ query }: { query: string }) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color={theme.colors.warning}>no results found for</Text>
      <Text> '{query}'</Text>
      <Box marginTop={1}>
        <Text dimColor>try </Text>
        <Text color={theme.colors.accent}>varg list</Text>
        <Text dimColor> to see all available items</Text>
      </Box>
    </Box>
  );
}

export const findCmd = defineCommand({
  meta: {
    name: "find",
    description: "search for models, actions, and skills",
  },
  args: {
    query: {
      type: "positional",
      description: "search query",
      required: true,
    },
    type: {
      type: "string",
      description: "filter by type (model, action, skill)",
    },
  },
  async run({ args }) {
    const query = args.query as string;
    const type = args.type as "model" | "action" | "skill" | undefined;

    const results = registry.search(query, { type });

    if (results.length === 0) {
      renderStatic(<NoResultsView query={query} />);
      return;
    }

    renderStatic(<FindView query={query} results={results} />);
  },
});
