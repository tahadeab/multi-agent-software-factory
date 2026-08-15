import { executeStandardAgent, type AgentExecutionContext, type StandardAgentOutput } from "./base";
export type ReviewerAgentInput = AgentExecutionContext;
export type ReviewerAgentOutput = StandardAgentOutput;
export const runReviewerAgent = (input: ReviewerAgentInput) => executeStandardAgent("reviewer", input);
