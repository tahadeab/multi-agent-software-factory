import { executeStandardAgent, type AgentExecutionContext, type StandardAgentOutput } from "./base";
export type SecurityAgentInput = AgentExecutionContext;
export type SecurityAgentOutput = StandardAgentOutput;
export const runSecurityAgent = (input: SecurityAgentInput) => executeStandardAgent("security", input);
