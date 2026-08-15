import { executeStandardAgent, type AgentExecutionContext, type StandardAgentOutput } from "./base";
export type PlannerAgentInput = AgentExecutionContext;
export type PlannerAgentOutput = StandardAgentOutput;
export const runPlannerAgent = (input: PlannerAgentInput) => executeStandardAgent("planner", input);
