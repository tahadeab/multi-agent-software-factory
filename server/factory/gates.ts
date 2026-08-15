import type { AgentId, ApprovalAction } from "@shared/factory";

export type ApprovalGate = { action: ApprovalAction; requestedAction: string; rationale: string };

export function approvalGateFor(agentId: AgentId, settings: Record<string, unknown>): ApprovalGate | null {
  if (agentId === "architect" && settings.requireArchitectureApproval !== false) {
    return { action: "ARCHITECTURE_APPROVAL", requestedAction: "Approve the generated architecture decisions before implementation begins.", rationale: "Architecture decisions determine the project boundaries, technology choices, and long-term trade-offs." };
  }
  if (agentId === "github" && settings.requireRepositoryApproval !== false) {
    return { action: "REPOSITORY_CREATION", requestedAction: "Approve the repository and branch workflow before external source-control actions begin.", rationale: "Repository creation and remote collaboration are external actions that must be explicitly authorized." };
  }
  if (agentId === "deployment" && settings.requireDeploymentApproval !== false) {
    return { action: "PRODUCTION_DEPLOYMENT", requestedAction: "Approve deployment of the prepared project to the selected target environment.", rationale: "Deployment may affect production systems and requires an explicit human decision." };
  }
  return null;
}
