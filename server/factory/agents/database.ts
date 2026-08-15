import { executeStandardAgent, type AgentExecutionContext, type StandardAgentOutput } from "./base";
export type DatabaseAgentInput = AgentExecutionContext;
export type DatabaseAgentOutput = StandardAgentOutput;
export const runDatabaseAgent = (input: DatabaseAgentInput) => executeStandardAgent("database", input);
