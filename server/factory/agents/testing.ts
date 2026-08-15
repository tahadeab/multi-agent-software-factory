import { executeStandardAgent, type AgentExecutionContext, type StandardAgentOutput } from "./base";
export type TestingAgentInput = AgentExecutionContext;
export type TestingAgentOutput = StandardAgentOutput;
export const runTestingAgent = (input: TestingAgentInput) => executeStandardAgent("testing", input);
