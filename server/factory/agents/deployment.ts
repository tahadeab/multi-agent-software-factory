import { executeStandardAgent, type AgentExecutionContext, type StandardAgentOutput } from "./base";
export type DeploymentAgentInput = AgentExecutionContext;
export type DeploymentAgentOutput = StandardAgentOutput;
export const runDeploymentAgent = (input: DeploymentAgentInput) => executeStandardAgent("deployment", input);
