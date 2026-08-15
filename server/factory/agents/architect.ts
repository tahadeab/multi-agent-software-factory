import { executeStandardAgent, type AgentExecutionContext, type StandardAgentOutput } from "./base";
export type ArchitectAgentInput = AgentExecutionContext;
export type ArchitectAgentOutput = StandardAgentOutput;
export const runArchitectAgent = (input: ArchitectAgentInput) => executeStandardAgent("architect", input);
