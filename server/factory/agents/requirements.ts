import { structuredRequirementsSchema, type StructuredRequirements } from "@shared/factory";
import { extractRequirements, type ModelUsage } from "../llm";

export type RequirementsAgentInput = { rawRequirement: string; model?: string };
export type RequirementsAgentOutput = StructuredRequirements;

export async function runRequirementsAgent(input: RequirementsAgentInput): Promise<{ output: RequirementsAgentOutput; model: string; usage: ModelUsage }> {
  const response = await extractRequirements(input);
  return { output: structuredRequirementsSchema.parse(response.data), model: response.model, usage: response.usage };
}
