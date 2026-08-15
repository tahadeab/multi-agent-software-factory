import { executeStandardAgent, type AgentExecutionContext, type StandardAgentOutput } from "./base";
export type GitHubAgentInput = AgentExecutionContext;
export type GitHubAgentOutput = StandardAgentOutput;
export const runGitHubAgent = (input: GitHubAgentInput) => executeStandardAgent("github", input);
