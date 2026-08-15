import { executeStandardAgent, type AgentExecutionContext, type StandardAgentOutput } from "./base";
export type DocumentationAgentInput = AgentExecutionContext;
export type DocumentationAgentOutput = StandardAgentOutput;
export const runDocumentationAgent = (input: DocumentationAgentInput) => executeStandardAgent("documentation", input);
