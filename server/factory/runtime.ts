import type { AgentId } from "@shared/factory";

export type RuntimeAgentRequest = {
  projectId: number;
  taskId: number;
  agentId: AgentId;
  payload: Record<string, unknown>;
};

export type RuntimeAgentResult = {
  status: "SUCCEEDED" | "FAILED";
  output?: Record<string, unknown>;
  error?: string;
  externalRunId?: string;
};

export type DeploymentRequest = {
  projectId: number;
  environment: "staging" | "production";
  artifactReferences: string[];
};

export type DeploymentResult = {
  status: "PREPARED" | "DEPLOYED" | "FAILED";
  provider: string;
  externalDeploymentId?: string;
  url?: string;
  error?: string;
};

export interface DeploymentProvider {
  readonly name: string;
  deploy(request: DeploymentRequest): Promise<DeploymentResult>;
  getStatus(externalDeploymentId: string): Promise<DeploymentResult>;
  rollback(externalDeploymentId: string): Promise<DeploymentResult>;
}

export interface AgentRuntime {
  readonly name: string;
  runAgent(request: RuntimeAgentRequest): Promise<RuntimeAgentResult>;
}

export class LocalRuntime implements AgentRuntime {
  readonly name = "local";

  async runAgent(): Promise<RuntimeAgentResult> {
    return { status: "FAILED", error: "Local runtime must be given an orchestrated agent executor." };
  }
}

export class ManusRuntime implements AgentRuntime {
  readonly name = "manus";

  async runAgent(): Promise<RuntimeAgentResult> {
    return {
      status: "FAILED",
      error: "Manus runtime is optional and has not been configured with an API credential and callback endpoint.",
    };
  }
}

/**
 * Safe default for development. It prepares the deployment record but never
 * calls an external host, so it cannot accidentally claim that code shipped.
 */
export class LocalDeploymentProvider implements DeploymentProvider {
  readonly name = "local-preparation";

  async deploy(request: DeploymentRequest): Promise<DeploymentResult> {
    return {
      status: "PREPARED",
      provider: this.name,
      externalDeploymentId: `prepared-${request.projectId}-${request.environment}`,
    };
  }

  async getStatus(externalDeploymentId: string): Promise<DeploymentResult> {
    return { status: "PREPARED", provider: this.name, externalDeploymentId };
  }

  async rollback(externalDeploymentId: string): Promise<DeploymentResult> {
    return { status: "PREPARED", provider: this.name, externalDeploymentId };
  }
}
