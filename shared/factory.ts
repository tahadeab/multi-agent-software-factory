import { z } from "zod";

export const AGENT_IDS = [
  "requirements",
  "planner",
  "architect",
  "research",
  "database",
  "developer",
  "testing",
  "security",
  "reviewer",
  "documentation",
  "github",
  "deployment",
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export const PROJECT_STATES = [
  "DRAFT",
  "PLANNING",
  "ARCHITECTURE",
  "RESEARCH",
  "DATABASE_DESIGN",
  "IMPLEMENTATION",
  "TESTING",
  "SECURITY_REVIEW",
  "CODE_REVIEW",
  "DOCUMENTATION",
  "GITHUB",
  "CI",
  "DEPLOYMENT",
  "AWAITING_HUMAN_APPROVAL",
  "PAUSED",
  "COMPLETED",
  "FAILED",
] as const;

export type ProjectState = (typeof PROJECT_STATES)[number];

export const TERMINAL_PROJECT_STATES = ["COMPLETED", "FAILED"] as const;

export const AGENT_RUN_STATES = [
  "WAITING",
  "RUNNING",
  "RETRYING",
  "SUCCEEDED",
  "FAILED",
  "BLOCKED",
  "SKIPPED",
] as const;

export type AgentRunState = (typeof AGENT_RUN_STATES)[number];

export const BACKGROUND_JOB_TYPES = ["WORKFLOW_ADVANCE"] as const;
export type BackgroundJobType = (typeof BACKGROUND_JOB_TYPES)[number];

export const BACKGROUND_JOB_STATUSES = ["QUEUED", "LEASED", "SUCCEEDED", "FAILED", "CANCELLED"] as const;
export type BackgroundJobStatus = (typeof BACKGROUND_JOB_STATUSES)[number];

export const IN_APP_NOTIFICATION_TYPES = ["BACKGROUND_JOB_FAILED"] as const;
export type InAppNotificationType = (typeof IN_APP_NOTIFICATION_TYPES)[number];

export const IN_APP_NOTIFICATION_SEVERITIES = ["ERROR"] as const;
export type InAppNotificationSeverity = (typeof IN_APP_NOTIFICATION_SEVERITIES)[number];

export const IN_APP_NOTIFICATION_STATUSES = ["UNREAD", "ACKNOWLEDGED", "RESOLVED"] as const;
export type InAppNotificationStatus = (typeof IN_APP_NOTIFICATION_STATUSES)[number];

export const EVENT_TYPES = [
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PLAN_CREATED",
  "TASK_CREATED",
  "TASK_COMPLETED",
  "AGENT_STARTED",
  "AGENT_COMPLETED",
  "AGENT_FAILED",
  "AGENT_RETRYING",
  "REVIEW_REQUESTED",
  "REVIEW_FAILED",
  "REVIEW_APPROVED",
  "APPROVAL_REQUESTED",
  "APPROVAL_GRANTED",
  "APPROVAL_REJECTED",
  "CI_STARTED",
  "CI_FAILED",
  "CI_PASSED",
  "DEPLOYMENT_REQUESTED",
  "DEPLOYMENT_APPROVED",
  "DEPLOYMENT_COMPLETED",
  "WORKFLOW_PAUSED",
  "WORKFLOW_RESUMED",
  "WORKFLOW_QUEUED",
  "WORKER_STARTED",
  "WORKER_CLAIMED_JOB",
  "WORKER_COMPLETED_JOB",
  "WORKER_FAILED_JOB",
  "WORKER_RECOVERED_LEASE",
  "WORKFLOW_COMPLETED",
  "WORKFLOW_FAILED",
] as const;

export type FactoryEventType = (typeof EVENT_TYPES)[number];

export const APPROVAL_ACTIONS = [
  "ARCHITECTURE_APPROVAL",
  "REPOSITORY_CREATION",
  "EXTERNAL_API_COST",
  "DESTRUCTIVE_DATABASE_MIGRATION",
  "PRODUCTION_DEPLOYMENT",
] as const;

export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const TOOL_NAMES = [
  "filesystem",
  "terminal",
  "git",
  "github",
  "browser",
  "web_search",
  "database",
  "test_runner",
  "docker",
  "deployment",
  "artifact_storage",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const structuredRequirementsSchema = z.object({
  projectName: z.string().min(1).max(160),
  summary: z.string().min(1).max(4_000),
  functionalRequirements: z.array(z.string().min(1).max(500)).max(100),
  nonFunctionalRequirements: z.array(z.string().min(1).max(500)).max(100),
  constraints: z.array(z.string().min(1).max(500)).max(100),
  assumptions: z.array(z.string().min(1).max(500)).max(100),
  ambiguities: z.array(z.string().min(1).max(500)).max(100),
  dependencies: z.array(z.string().min(1).max(500)).max(100),
  acceptanceCriteria: z.array(z.string().min(1).max(500)).max(100),
});

export type StructuredRequirements = z.infer<typeof structuredRequirementsSchema>;

export const orchestratorSettingsSchema = z.object({
  maxRetries: z.number().int().min(0).max(8).default(3),
  maxReviewIterations: z.number().int().min(1).max(10).default(3),
  defaultModel: z.string().min(1).max(160).default("gpt-5-mini"),
  advancedModel: z.string().min(1).max(160).default("gpt-5"),
  requireArchitectureApproval: z.boolean().default(true),
  requireRepositoryApproval: z.boolean().default(true),
  requireDeploymentApproval: z.boolean().default(true),
});

export type OrchestratorSettings = z.infer<typeof orchestratorSettingsSchema>;

export const DEFAULT_ORCHESTRATOR_SETTINGS: OrchestratorSettings = {
  maxRetries: 3,
  maxReviewIterations: 3,
  defaultModel: "gpt-5-mini",
  advancedModel: "gpt-5",
  requireArchitectureApproval: true,
  requireRepositoryApproval: true,
  requireDeploymentApproval: true,
};

export type AgentDefinition = {
  id: AgentId;
  label: string;
  purpose: string;
  tools: ToolName[];
  dependencies: AgentId[];
  stateAfterSuccess: ProjectState;
};

export const AGENT_DEFINITIONS: Record<AgentId, AgentDefinition> = {
  requirements: {
    id: "requirements",
    label: "Requirements Agent",
    purpose: "Extracts a precise, reviewable software requirements specification.",
    tools: ["artifact_storage"],
    dependencies: [],
    stateAfterSuccess: "PLANNING",
  },
  planner: {
    id: "planner",
    label: "Planner Agent",
    purpose: "Builds a dependency-aware execution plan from the approved requirements.",
    tools: ["artifact_storage"],
    dependencies: ["requirements"],
    stateAfterSuccess: "ARCHITECTURE",
  },
  architect: {
    id: "architect",
    label: "Architect Agent",
    purpose: "Produces architecture decisions, interfaces, boundaries, and technical trade-offs.",
    tools: ["artifact_storage", "web_search"],
    dependencies: ["planner"],
    stateAfterSuccess: "ARCHITECTURE",
  },
  research: {
    id: "research",
    label: "Research Agent",
    purpose: "Collects implementation-relevant sources and traceable research findings.",
    tools: ["web_search", "browser", "artifact_storage"],
    dependencies: ["planner"],
    stateAfterSuccess: "RESEARCH",
  },
  database: {
    id: "database",
    label: "Database Agent",
    purpose: "Designs schema, relationships, constraints, indexes, and migration strategy.",
    tools: ["database", "artifact_storage"],
    dependencies: ["planner"],
    stateAfterSuccess: "DATABASE_DESIGN",
  },
  developer: {
    id: "developer",
    label: "Developer Agent",
    purpose: "Implements changes incrementally from approved engineering artifacts.",
    tools: ["filesystem", "terminal", "git", "test_runner", "artifact_storage"],
    dependencies: ["architect", "research", "database"],
    stateAfterSuccess: "IMPLEMENTATION",
  },
  testing: {
    id: "testing",
    label: "Testing Agent",
    purpose: "Creates and executes unit, integration, API, and end-to-end verification.",
    tools: ["filesystem", "terminal", "test_runner", "artifact_storage"],
    dependencies: ["developer"],
    stateAfterSuccess: "TESTING",
  },
  security: {
    id: "security",
    label: "Security Agent",
    purpose: "Assesses code and configuration for security weaknesses and remediation.",
    tools: ["filesystem", "terminal", "test_runner", "artifact_storage"],
    dependencies: ["developer"],
    stateAfterSuccess: "SECURITY_REVIEW",
  },
  reviewer: {
    id: "reviewer",
    label: "Reviewer Agent",
    purpose: "Performs senior-level review of code, security, tests, and maintainability.",
    tools: ["filesystem", "git", "artifact_storage"],
    dependencies: ["testing", "security"],
    stateAfterSuccess: "CODE_REVIEW",
  },
  documentation: {
    id: "documentation",
    label: "Documentation Agent",
    purpose: "Creates implementation-grounded documentation and project handover artifacts.",
    tools: ["filesystem", "artifact_storage"],
    dependencies: ["reviewer"],
    stateAfterSuccess: "DOCUMENTATION",
  },
  github: {
    id: "github",
    label: "GitHub Agent",
    purpose: "Coordinates repository, branch, pull request, issue, and CI integration.",
    tools: ["git", "github", "artifact_storage"],
    dependencies: ["documentation"],
    stateAfterSuccess: "GITHUB",
  },
  deployment: {
    id: "deployment",
    label: "Deployment Agent",
    purpose: "Prepares an approved deployment, tracks status, and exposes rollback options.",
    tools: ["docker", "deployment", "artifact_storage"],
    dependencies: ["github"],
    stateAfterSuccess: "DEPLOYMENT",
  },
};

export function getWorkflowAgentIds(): AgentId[] {
  return AGENT_IDS.slice();
}

export function dependenciesFor(agentId: AgentId): AgentId[] {
  return AGENT_DEFINITIONS[agentId].dependencies.slice();
}
