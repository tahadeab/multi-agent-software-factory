import { describe, expect, it, vi } from "vitest";

const validSrs = {
  projectName: "Task platform",
  summary: "Collaborative task management.",
  functionalRequirements: ["Users can create tasks"],
  nonFunctionalRequirements: ["Responsive interface"],
  constraints: [],
  assumptions: [],
  ambiguities: [],
  dependencies: [],
  acceptanceCriteria: ["A user can create a task"],
};

vi.mock("./llm", () => ({
  extractRequirements: vi.fn().mockResolvedValue({
    data: {
      projectName: "Task platform",
      summary: "Collaborative task management.",
      functionalRequirements: ["Users can create tasks"],
      nonFunctionalRequirements: ["Responsive interface"],
      constraints: [],
      assumptions: [],
      ambiguities: [],
      dependencies: [],
      acceptanceCriteria: ["A user can create a task"],
    },
    model: "gpt-5-mini",
    usage: { totalTokens: 42 },
  }),
}));

import { structuredRequirementsSchema } from "@shared/factory";
import { runRequirementsAgent } from "./agents/requirements";

describe("agent contracts", () => {
  it("validates a complete structured SRS", () => {
    expect(structuredRequirementsSchema.parse(validSrs).projectName).toBe("Task platform");
  });

  it("rejects an incomplete SRS payload", () => {
    expect(() => structuredRequirementsSchema.parse({ projectName: "Incomplete" })).toThrow();
  });

  it("validates the Requirements Agent output from the shared LLM abstraction", async () => {
    const result = await runRequirementsAgent({ rawRequirement: "Build collaborative task management." });
    expect(result.output.acceptanceCriteria).toEqual(["A user can create a task"]);
    expect(result.model).toBe("gpt-5-mini");
  });
});
