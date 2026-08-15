import { executeStandardAgent, type AgentExecutionContext, type StandardAgentOutput } from "./base";
export type ResearchAgentInput = AgentExecutionContext;
export type ResearchAgentOutput = StandardAgentOutput;
export const runResearchAgent = (input: ResearchAgentInput) => executeStandardAgent("research", input);
