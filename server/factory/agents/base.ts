import { z } from "zod";
import { runStructuredAgent, type ModelUsage } from "../llm";
import type { AgentId } from "@shared/factory";

export const standardAgentOutputSchema = z.object({
  summary: z.string(),
  decisions: z.array(z.string()),
  risks: z.array(z.string()),
  recommendations: z.array(z.string()),
  artifacts: z.array(z.object({ name: z.string(), content: z.string(), kind: z.string() })),
});

export type StandardAgentOutput = z.infer<typeof standardAgentOutputSchema>;

export type AgentExecutionContext = {
  projectId: number;
  projectName: string;
  rawRequirement: string;
  sharedState: Record<string, unknown>;
  taskId: number;
  attempt: number;
  model?: string;
};

export type AgentExecutionResult<T> = {
  output: T;
  model: string;
  usage: ModelUsage;
};

export async function executeStandardAgent(
  agentId: Exclude<AgentId, "requirements">,
  context: AgentExecutionContext
): Promise<AgentExecutionResult<StandardAgentOutput>> {
  const response = await runStructuredAgent<StandardAgentOutput>({
    agentId,
    model: context.model,
    projectContext: {
      projectId: context.projectId,
      projectName: context.projectName,
      rawRequirement: context.rawRequirement,
      sharedState: context.sharedState,
      taskId: context.taskId,
      attempt: context.attempt,
    },
  });
  return { output: standardAgentOutputSchema.parse(response.data), model: response.model, usage: response.usage };
}
