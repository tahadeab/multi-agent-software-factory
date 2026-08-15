import { executeStandardAgent, type AgentExecutionContext, type StandardAgentOutput } from "./base";
export type DeveloperAgentInput = AgentExecutionContext;
export type DeveloperAgentOutput = StandardAgentOutput;
export const runDeveloperAgent = (input: DeveloperAgentInput) => executeStandardAgent("developer", input);
