import { describe, expect, it } from "vitest";
import { structuredRequirementsSchema } from "./factory";

describe("structured requirements schema", () => {
  it("accepts a complete SRS shape", () => {
    const result = structuredRequirementsSchema.parse({
      projectName: "Task platform",
      summary: "Collaborative task management.",
      functionalRequirements: ["Users can create tasks"],
      nonFunctionalRequirements: ["Responsive interface"],
      constraints: [],
      assumptions: [],
      ambiguities: [],
      dependencies: [],
      acceptanceCriteria: ["A user can create a task"],
    });
    expect(result.projectName).toBe("Task platform");
  });

  it("rejects an incomplete requirements response", () => {
    expect(() => structuredRequirementsSchema.parse({ projectName: "Missing fields" })).toThrow();
  });
});
