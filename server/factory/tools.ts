import { AGENT_DEFINITIONS, type AgentId, type ToolName } from "@shared/factory";

export type ScopedTool = {
  name: ToolName;
  enabled: boolean;
  description: string;
  requiresConfiguration?: boolean;
};

const TOOL_CATALOG: Record<ToolName, Omit<ScopedTool, "enabled">> = {
  filesystem: { name: "filesystem", description: "Inspects and edits files within an isolated generated-project workspace." },
  terminal: { name: "terminal", description: "Executes allowlisted commands in an isolated generated-project workspace." },
  git: { name: "git", description: "Performs repository-local branch, diff, and commit operations." },
  github: { name: "github", description: "Performs configured GitHub repository and pull-request actions.", requiresConfiguration: true },
  browser: { name: "browser", description: "Retrieves public implementation documentation through controlled navigation." },
  web_search: { name: "web_search", description: "Finds public technical sources for research with source records." },
  database: { name: "database", description: "Designs and applies only approved database changes through the schema boundary." },
  test_runner: { name: "test_runner", description: "Runs declared test commands and records actual results." },
  docker: { name: "docker", description: "Prepares container definitions and validates build configuration where a runtime is available." },
  deployment: { name: "deployment", description: "Uses configured deployment providers only after an explicit approval gate." , requiresConfiguration: true },
  artifact_storage: { name: "artifact_storage", description: "Persists generated reports and source artifacts in private object storage." },
};

export function getScopedTools(agentId: AgentId): ScopedTool[] {
  const permitted = new Set(AGENT_DEFINITIONS[agentId].tools);
  return (Object.keys(TOOL_CATALOG) as ToolName[]).map(toolName => ({
    ...TOOL_CATALOG[toolName],
    enabled: permitted.has(toolName),
  }));
}

export function assertToolPermission(agentId: AgentId, toolName: ToolName) {
  if (!AGENT_DEFINITIONS[agentId].tools.includes(toolName)) {
    throw new Error(`${AGENT_DEFINITIONS[agentId].label} is not permitted to use ${toolName}`);
  }
}

export function availableToolNames(agentId: AgentId) {
  return AGENT_DEFINITIONS[agentId].tools.slice();
}
