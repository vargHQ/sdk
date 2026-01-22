import { defineCommand } from "citty";
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
      <box style={{ marginTop: 1 }}>
        <VargText variant="muted">
          {results.length} result{results.length > 1 ? "s" : ""}
        </VargText>
      </box>
    </VargBox>
  );
}

function NoResultsView({ query }: { query: string }) {
  return (
    <box style={{ flexDirection: "column", padding: 1 }}>
      <VargText variant="warning">no results found for</VargText>
      <text> '{query}'</text>
      <box style={{ marginTop: 1 }}>
        <VargText variant="muted">try </VargText>
        <VargText variant="accent">varg list</VargText>
        <VargText variant="muted"> to see all available items</VargText>
      </box>
    </box>
  );
}

function FindHelpView() {
  return (
    <VargBox title="varg find">
      <box style={{ marginBottom: 1 }}>
        <text>search for models, actions, and skills</text>
      </box>

      <Header>USAGE</Header>
      <box style={{ paddingLeft: 2, marginBottom: 1 }}>
        <VargText variant="accent">
          varg find {"<query>"} [--type type]
        </VargText>
      </box>

      <Header>ARGUMENTS</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2, marginBottom: 1 }}>
        <text>query search term to find</text>
      </box>

      <Header>OPTIONS</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2, marginBottom: 1 }}>
        <text>--type filter by type: model, action, skill</text>
      </box>

      <Header>EXAMPLES</Header>
      <box style={{ flexDirection: "column", paddingLeft: 2 }}>
        <box style={{ flexDirection: "column", marginBottom: 1 }}>
          <text fg="gray"># search for video-related items</text>
          <VargText variant="accent">varg find video</VargText>
        </box>
        <box style={{ flexDirection: "column" }}>
          <text fg="gray"># search only in models</text>
          <VargText variant="accent">varg find flux --type model</VargText>
        </box>
      </box>
    </VargBox>
  );
}

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
