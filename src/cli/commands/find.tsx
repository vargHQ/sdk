/** @jsxImportSource react */
/**
 * varg find command
 * Ink-based search view
 */

import { defineCommand } from "citty";
import { Box, Text } from "ink";
import { registry } from "../../core/registry/index.ts";
import { DataTable, Header, VargBox, VargText } from "../ui/index.ts";
import { renderStatic } from "../ui/render.ts";

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
        <VargText variant="muted">
          {results.length} result{results.length > 1 ? "s" : ""}
        </VargText>
      </Box>
    </VargBox>
  );
}

function NoResultsView({ query }: { query: string }) {
  return (
    <Box flexDirection="column" padding={1}>
      <VargText variant="warning">no results found for</VargText>
      <Text> '{query}'</Text>
      <Box marginTop={1}>
        <VargText variant="muted">try </VargText>
        <VargText variant="accent">varg list</VargText>
        <VargText variant="muted"> to see all available items</VargText>
      </Box>
    </Box>
  );
}

/** Help view for find command */
function FindHelpView() {
  return (
    <VargBox title="varg find">
      <Box marginBottom={1}>
        <Text>search for models, actions, and skills</Text>
      </Box>

      <Header>USAGE</Header>
      <Box paddingLeft={2} marginBottom={1}>
        <VargText variant="accent">
          varg find {"<query>"} [--type type]
        </VargText>
      </Box>

      <Header>ARGUMENTS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>query search term to find</Text>
      </Box>

      <Header>OPTIONS</Header>
      <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
        <Text>--type filter by type: model, action, skill</Text>
      </Box>

      <Header>EXAMPLES</Header>
      <Box flexDirection="column" paddingLeft={2}>
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor># search for video-related items</Text>
          <VargText variant="accent">varg find video</VargText>
        </Box>
        <Box flexDirection="column">
          <Text dimColor># search only in models</Text>
          <VargText variant="accent">varg find flux --type model</VargText>
        </Box>
      </Box>
    </VargBox>
  );
}

/** Show find command help */
export function showFindHelp() {
  renderStatic(<FindHelpView />);
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
      required: false,
    },
    type: {
      type: "string",
      description: "filter by type (model, action, skill)",
    },
  },
  async run({ args, rawArgs }) {
    // Handle --help
    if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
      showFindHelp();
      return;
    }

    const query = args.query as string;

    if (!query) {
      showFindHelp();
      return;
    }

    const type = args.type as "model" | "action" | "skill" | undefined;

    const results = registry.search(query, { type });

    if (results.length === 0) {
      renderStatic(<NoResultsView query={query} />);
      return;
    }

    renderStatic(<FindView query={query} results={results} />);
  },
});
