import { describe, expect, it } from "vitest";
import { approvalGateFor } from "./gates";

describe("approval gates", () => {
  it("holds architecture, repository, and deployment actions for approval", () => {
    expect(approvalGateFor("architect", {} )?.action).toBe("ARCHITECTURE_APPROVAL");
    expect(approvalGateFor("github", {} )?.action).toBe("REPOSITORY_CREATION");
    expect(approvalGateFor("deployment", {} )?.action).toBe("PRODUCTION_DEPLOYMENT");
  });

  it("honors a disabled architecture approval setting", () => {
    expect(approvalGateFor("architect", { requireArchitectureApproval: false })).toBeNull();
  });
});
