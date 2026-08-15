import { and, asc, desc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import {
  AGENT_DEFINITIONS,
  AGENT_IDS,
  DEFAULT_ORCHESTRATOR_SETTINGS,
  type AgentId,
  type AgentRunState,
  type ApprovalAction,
  type BackgroundJobStatus,
  type FactoryEventType,
  type OrchestratorSettings,
  type ProjectState,
  type StructuredRequirements,
} from "@shared/factory";
import {
  agentRuns,
  agents,
  architectureDecisions,
  approvals,
  artifacts,
  backgroundJobs,
  deployments,
  events,
  inAppNotifications,
  projectTasks,
  projects,
  requirements,
  reviews,
  securityFindings,
  type Project,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { failureAggregationKey, groupedFailureMessage, nextNotificationAggregationState } from "./notificationAggregation";

export type SharedProjectState = {
  requirements: StructuredRequirements | null;
  architecture: Record<string, unknown> | null;
  database: Record<string, unknown> | null;
  research: Record<string, unknown> | null;
  implementation: Record<string, unknown> | null;
  repository: Record<string, unknown> | null;
  ci: Record<string, unknown> | null;
  deployment: Record<string, unknown> | null;
  generatedAt: string;
};

export const initialSharedState = (): SharedProjectState => ({
  requirements: null,
  architecture: null,
  database: null,
  research: null,
  implementation: null,
  repository: null,
  ci: null,
  deployment: null,
  generatedAt: new Date().toISOString(),
});

const requireDb = async () => {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db;
};

export async function ensureAgentCatalog() {
  const db = await requireDb();
  await Promise.all(
    AGENT_IDS.map(agentId => {
      const definition = AGENT_DEFINITIONS[agentId];
      return db
        .insert(agents)
        .values({
          agentId,
          name: definition.label,
          description: definition.purpose,
          toolPermissions: definition.tools,
          inputSchema: { type: "object", title: `${definition.label} input` },
          outputSchema: { type: "object", title: `${definition.label} output` },
        })
        .onDuplicateKeyUpdate({
          set: {
            name: definition.label,
            description: definition.purpose,
            toolPermissions: definition.tools,
            inputSchema: { type: "object", title: `${definition.label} input` },
            outputSchema: { type: "object", title: `${definition.label} output` },
          },
        });
    })
  );
}

export async function recordEvent(input: {
  projectId: number;
  eventType: FactoryEventType;
  actor: string;
  summary: string;
  payload?: Record<string, unknown>;
  agentRunId?: number;
}) {
  const db = await requireDb();
  await db.insert(events).values({
    projectId: input.projectId,
    agentRunId: input.agentRunId,
    eventType: input.eventType,
    actor: input.actor,
    summary: input.summary,
    payload: input.payload ?? {},
  });
}

export async function createProjectWorkflow(input: {
  ownerId: number;
  rawRequirement: string;
  name?: string;
  settings?: Partial<OrchestratorSettings>;
}) {
  const db = await requireDb();
  const settings = { ...DEFAULT_ORCHESTRATOR_SETTINGS, ...(input.settings ?? {}) };
  const projectName = input.name?.trim() || "Untitled software initiative";
  const [created] = await db.insert(projects).values({
    ownerId: input.ownerId,
    name: projectName,
    rawRequirement: input.rawRequirement,
    status: "DRAFT",
    progress: 0,
    currentPhase: "Intake",
    settings,
    sharedState: initialSharedState(),
  }).$returningId();

  const projectId = created.id;
  await ensureAgentCatalog();

  const taskIds = new Map<AgentId, number>();
  for (const agentId of AGENT_IDS) {
    const definition = AGENT_DEFINITIONS[agentId];
    const [createdTask] = await db.insert(projectTasks).values({
      projectId,
      agentId,
      title: definition.label,
      description: definition.purpose,
      status: "WAITING",
      priority: agentId === "requirements" || agentId === "planner" ? "high" : "medium",
      dependencies: [],
      maxAttempts: settings.maxRetries + 1,
      maxReviewIterations: settings.maxReviewIterations,
    }).$returningId();
    taskIds.set(agentId, createdTask.id);
  }

  for (const agentId of AGENT_IDS) {
    const dependencyIds = AGENT_DEFINITIONS[agentId].dependencies.map(dependency => taskIds.get(dependency)!);
    await db.update(projectTasks)
      .set({ dependencies: dependencyIds })
      .where(and(eq(projectTasks.projectId, projectId), eq(projectTasks.agentId, agentId)));
  }

  await recordEvent({
    projectId,
    eventType: "PROJECT_CREATED",
    actor: "system",
    summary: "Project intake recorded and workflow graph created.",
    payload: { projectName, taskCount: AGENT_IDS.length },
  });

  return getProjectById(projectId);
}

export async function getProjectById(projectId: number) {
  const db = await requireDb();
  const rows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return rows[0];
}

export async function getOwnedProject(projectId: number, ownerId: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
    .limit(1);
  return rows[0];
}

export async function listProjectsForOwner(ownerId: number) {
  const db = await requireDb();
  return db.select().from(projects).where(eq(projects.ownerId, ownerId)).orderBy(desc(projects.lastActivityAt));
}

export async function getProjectSnapshot(projectId: number) {
  const db = await requireDb();
  const [project, tasks, runs, projectEvents, projectApprovals, projectArtifacts, projectDecisions, projectReviews, projectSecurityFindings, projectDeployments, projectBackgroundJobs] = await Promise.all([
    getProjectById(projectId),
    db.select().from(projectTasks).where(eq(projectTasks.projectId, projectId)).orderBy(asc(projectTasks.id)),
    db.select().from(agentRuns).where(eq(agentRuns.projectId, projectId)).orderBy(desc(agentRuns.createdAt)),
    db.select().from(events).where(eq(events.projectId, projectId)).orderBy(desc(events.createdAt)).limit(120),
    db.select().from(approvals).where(eq(approvals.projectId, projectId)).orderBy(desc(approvals.requestedAt)),
    db.select().from(artifacts).where(eq(artifacts.projectId, projectId)).orderBy(desc(artifacts.createdAt)),
    db.select().from(architectureDecisions).where(eq(architectureDecisions.projectId, projectId)).orderBy(desc(architectureDecisions.createdAt)),
    db.select().from(reviews).where(eq(reviews.projectId, projectId)).orderBy(desc(reviews.createdAt)),
    db.select().from(securityFindings).where(eq(securityFindings.projectId, projectId)).orderBy(desc(securityFindings.createdAt)),
    db.select().from(deployments).where(eq(deployments.projectId, projectId)).orderBy(desc(deployments.createdAt)),
    db.select().from(backgroundJobs).where(eq(backgroundJobs.projectId, projectId)).orderBy(desc(backgroundJobs.updatedAt)).limit(20),
  ]);
  return {
    project,
    tasks,
    runs,
    events: projectEvents,
    approvals: projectApprovals,
    artifacts: projectArtifacts,
    architectureDecisions: projectDecisions,
    reviews: projectReviews,
    securityFindings: projectSecurityFindings,
    deployments: projectDeployments,
    backgroundJobs: projectBackgroundJobs,
  };
}

export async function updateProject(input: {
  projectId: number;
  values: Partial<Pick<Project, "name" | "status" | "progress" | "currentPhase" | "repositoryUrl" | "repositoryBranch" | "currentCommit" | "ciStatus" | "deploymentStatus" | "deploymentUrl" | "lastError">> & {
    settings?: OrchestratorSettings;
    sharedState?: SharedProjectState;
  };
}) {
  const db = await requireDb();
  await db.update(projects).set({ ...input.values, lastActivityAt: new Date() }).where(eq(projects.id, input.projectId));
}

export async function saveRequirements(projectId: number, specification: StructuredRequirements) {
  const db = await requireDb();
  await db.insert(requirements).values({
    projectId,
    version: 1,
    status: "EXTRACTED",
    structured: specification,
  }).onDuplicateKeyUpdate({ set: { status: "EXTRACTED", structured: specification } });

  const project = await getProjectById(projectId);
  if (!project) throw new Error("Project not found");
  const currentState = project.sharedState as SharedProjectState;
  await updateProject({
    projectId,
    values: {
      name: specification.projectName,
      sharedState: { ...currentState, requirements: specification, generatedAt: new Date().toISOString() },
    },
  });
}

export async function updateTask(input: {
  taskId: number;
  status?: AgentRunState;
  attemptCount?: number;
  error?: string | null;
  output?: Record<string, unknown> | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}) {
  const db = await requireDb();
  const { taskId, ...values } = input;
  await db.update(projectTasks).set(values).where(eq(projectTasks.id, taskId));
}

export async function createAgentRun(input: {
  projectId: number;
  taskId: number;
  agentId: AgentId;
  attempt: number;
  model: string;
  payload: Record<string, unknown>;
}) {
  const db = await requireDb();
  const [created] = await db.insert(agentRuns).values({
    projectId: input.projectId,
    taskId: input.taskId,
    agentId: input.agentId,
    status: "RUNNING",
    attempt: input.attempt,
    model: input.model,
    input: input.payload,
    toolCalls: [],
    startedAt: new Date(),
  }).$returningId();
  return created.id;
}

export async function finishAgentRun(input: {
  runId: number;
  status: Extract<AgentRunState, "SUCCEEDED" | "FAILED">;
  output?: Record<string, unknown>;
  error?: string;
  toolCalls?: Array<Record<string, unknown>>;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}) {
  const db = await requireDb();
  await db.update(agentRuns).set({
    status: input.status,
    output: input.output ?? null,
    error: input.error,
    toolCalls: input.toolCalls ?? [],
    promptTokens: input.usage?.promptTokens,
    completionTokens: input.usage?.completionTokens,
    totalTokens: input.usage?.totalTokens,
    completedAt: new Date(),
  }).where(eq(agentRuns.id, input.runId));
}

function outputStrings(output: Record<string, unknown>, key: string) {
  const values = output[key];
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
}

/** Persists only agent-produced findings; it never fabricates external execution results. */
export async function persistAgentStageOutput(input: {
  projectId: number;
  agentRunId: number;
  agentId: AgentId;
  output: Record<string, unknown>;
}) {
  const db = await requireDb();
  const decisions = outputStrings(input.output, "decisions");
  const risks = outputStrings(input.output, "risks");
  const recommendations = outputStrings(input.output, "recommendations");
  const summary = typeof input.output.summary === "string" ? input.output.summary : "Agent output recorded.";

  if (input.agentId === "architect") {
    await Promise.all(decisions.map((decision, index) => db.insert(architectureDecisions).values({
      projectId: input.projectId,
      title: `Architecture decision ${index + 1}`,
      status: "PROPOSED",
      context: summary,
      decision,
      rationale: recommendations[index] ?? recommendations[0] ?? "Rationale requires human review.",
      tradeoffs: risks.join("\n") || "Trade-offs require human review.",
    })));
  }

  if (input.agentId === "security") {
    await Promise.all(risks.map((risk, index) => db.insert(securityFindings).values({
      projectId: input.projectId,
      agentRunId: input.agentRunId,
      severity: "MEDIUM",
      category: "AI-assisted security review",
      title: `Security finding ${index + 1}`,
      description: risk,
      remediation: recommendations[index] ?? recommendations[0] ?? "Human review required before remediation.",
      status: "OPEN",
    })));
  }

  if (input.agentId === "reviewer") {
    await Promise.all(risks.map((risk, index) => db.insert(reviews).values({
      projectId: input.projectId,
      agentRunId: input.agentRunId,
      severity: "MEDIUM",
      issue: risk,
      recommendation: recommendations[index] ?? recommendations[0] ?? "Human review required before remediation.",
      status: "OPEN",
    })));
  }

  if (input.agentId === "deployment") {
    await db.insert(deployments).values({
      projectId: input.projectId,
      provider: "local-preparation",
      environment: "staging",
      status: "PREPARED",
      metadata: { summary, decisions, risks, recommendations },
      startedAt: new Date(),
      completedAt: new Date(),
    });
  }
}

export async function createApproval(input: {
  projectId: number;
  action: ApprovalAction;
  requestedBy: string;
  requestedAction: string;
  rationale: string;
}) {
  const db = await requireDb();
  const [existing] = await db.select().from(approvals).where(and(
    eq(approvals.projectId, input.projectId),
    eq(approvals.action, input.action),
    eq(approvals.status, "AWAITING_HUMAN_APPROVAL")
  )).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(approvals).values(input).$returningId();
  const createdApproval = await db.select().from(approvals).where(eq(approvals.id, created.id)).limit(1);
  return createdApproval[0];
}

export async function resolveApproval(input: {
  approvalId: number;
  userId: number;
  approved: boolean;
  note?: string;
}) {
  const db = await requireDb();
  await db.update(approvals).set({
    status: input.approved ? "APPROVED" : "REJECTED",
    resolvedByUserId: input.userId,
    resolutionNote: input.note,
    resolvedAt: new Date(),
  }).where(eq(approvals.id, input.approvalId));
  const rows = await db.select().from(approvals).where(eq(approvals.id, input.approvalId)).limit(1);
  return rows[0];
}

export async function listOpenApprovals(ownerId: number) {
  const db = await requireDb();
  const owned = await listProjectsForOwner(ownerId);
  if (owned.length === 0) return [];
  return db.select().from(approvals).where(and(
    inArray(approvals.projectId, owned.map(project => project.id)),
    eq(approvals.status, "AWAITING_HUMAN_APPROVAL")
  )).orderBy(desc(approvals.requestedAt));
}

export async function saveArtifact(input: {
  projectId: number;
  agentRunId?: number;
  kind: string;
  name: string;
  storageKey: string;
  storageUrl: string;
  contentType: string;
  sizeBytes: number;
  metadata?: Record<string, unknown>;
}) {
  const db = await requireDb();
  const [created] = await db.insert(artifacts).values({ ...input, metadata: input.metadata ?? {} }).$returningId();
  return created.id;
}

export async function recoverInterruptedWorkflows() {
  const db = await requireDb();
  const interrupted = await db.select().from(projectTasks).where(eq(projectTasks.status, "RUNNING"));
  await Promise.all(interrupted.map(task => db.update(projectTasks).set({ status: "RETRYING", error: "Recovered after an interrupted worker process." }).where(eq(projectTasks.id, task.id))));
  return interrupted.length;
}

export async function enqueueWorkflowWork(input: {
  projectId: number;
  reason: string;
  priority?: number;
}) {
  const db = await requireDb();
  const now = new Date();
  const existing = (await db.select().from(backgroundJobs).where(and(
    eq(backgroundJobs.projectId, input.projectId),
    eq(backgroundJobs.dedupeKey, "workflow")
  )).limit(1))[0];

  if (existing?.status === "LEASED") return existing;

  const payload = { reason: input.reason, enqueuedAt: now.toISOString() };
  if (existing) {
    await db.update(backgroundJobs).set({
      status: "QUEUED",
      payload,
      priority: input.priority ?? existing.priority,
      availableAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastError: null,
      completedAt: null,
    }).where(eq(backgroundJobs.id, existing.id));
  } else {
    await db.insert(backgroundJobs).values({
      projectId: input.projectId,
      jobType: "WORKFLOW_ADVANCE",
      dedupeKey: "workflow",
      status: "QUEUED",
      payload,
      priority: input.priority ?? 100,
      maxAttempts: 8,
      availableAt: now,
    });
  }

  return (await db.select().from(backgroundJobs).where(and(
    eq(backgroundJobs.projectId, input.projectId),
    eq(backgroundJobs.dedupeKey, "workflow")
  )).limit(1))[0];
}

export async function leaseNextBackgroundJob(input: { workerId: string; leaseMs: number }) {
  const db = await requireDb();
  const now = new Date();
  const candidate = (await db.select().from(backgroundJobs).where(and(
    eq(backgroundJobs.status, "QUEUED"),
    lte(backgroundJobs.availableAt, now)
  )).orderBy(desc(backgroundJobs.priority), asc(backgroundJobs.createdAt)).limit(1))[0];
  if (!candidate) return undefined;

  const leaseExpiresAt = new Date(now.getTime() + input.leaseMs);
  const result = await db.update(backgroundJobs).set({
    status: "LEASED",
    leaseOwner: input.workerId,
    leaseExpiresAt,
    attemptCount: sql<number>`${backgroundJobs.attemptCount} + 1`,
  }).where(and(eq(backgroundJobs.id, candidate.id), eq(backgroundJobs.status, "QUEUED")));
  const affectedRows = Array.isArray(result) ? result[0]?.affectedRows ?? 0 : 0;
  if (affectedRows === 0) return undefined;

  return {
    ...candidate,
    status: "LEASED" as BackgroundJobStatus,
    leaseOwner: input.workerId,
    leaseExpiresAt,
    attemptCount: candidate.attemptCount + 1,
  };
}

export async function completeBackgroundJob(input: { jobId: number; workerId: string }) {
  const db = await requireDb();
  await db.update(backgroundJobs).set({
    status: "SUCCEEDED",
    leaseOwner: null,
    leaseExpiresAt: null,
    completedAt: new Date(),
  }).where(and(eq(backgroundJobs.id, input.jobId), eq(backgroundJobs.leaseOwner, input.workerId)));
}

export async function failBackgroundJob(input: { jobId: number; workerId: string; error: string }) {
  const db = await requireDb();
  await db.update(backgroundJobs).set({
    status: "FAILED",
    leaseOwner: null,
    leaseExpiresAt: null,
    lastError: input.error.slice(0, 4_000),
    completedAt: new Date(),
  }).where(and(eq(backgroundJobs.id, input.jobId), eq(backgroundJobs.leaseOwner, input.workerId)));
}

export async function recoverExpiredBackgroundLeases() {
  const db = await requireDb();
  const now = new Date();
  const expired = await db.select().from(backgroundJobs).where(and(
    eq(backgroundJobs.status, "LEASED"),
    lt(backgroundJobs.leaseExpiresAt, now)
  ));
  if (expired.length === 0) return [];
  await db.update(backgroundJobs).set({
    status: "QUEUED",
    leaseOwner: null,
    leaseExpiresAt: null,
    availableAt: now,
    lastError: "Recovered after an expired worker lease.",
  }).where(inArray(backgroundJobs.id, expired.map(job => job.id)));
  return expired;
}

export async function cancelQueuedWorkflowWork(projectId: number) {
  const db = await requireDb();
  await db.update(backgroundJobs).set({
    status: "CANCELLED",
    completedAt: new Date(),
  }).where(and(
    eq(backgroundJobs.projectId, projectId),
    eq(backgroundJobs.dedupeKey, "workflow"),
    eq(backgroundJobs.status, "QUEUED")
  ));
}

export async function createBackgroundJobFailureNotification(input: {
  projectId: number;
  backgroundJobId: number;
  jobType?: string;
  error: string;
  attemptCount: number;
}) {
  const db = await requireDb();
  const project = await getProjectById(input.projectId);
  if (!project) throw new Error("Project not found while creating notification");
  const now = new Date();
  const aggregationKey = failureAggregationKey({
    ownerId: project.ownerId,
    projectId: input.projectId,
    jobType: input.jobType ?? "WORKFLOW_ADVANCE",
    error: input.error,
  });
  const existing = (await db.select().from(inAppNotifications).where(and(
    eq(inAppNotifications.aggregationKey, aggregationKey),
    eq(inAppNotifications.type, "BACKGROUND_JOB_FAILED")
  )).limit(1))[0];
  const title = `Background workflow failed — ${project.name}`;
  const state = nextNotificationAggregationState(existing, now);
  const message = groupedFailureMessage({
    projectName: project.name,
    repeatCount: state.repeatCount,
    attemptCount: input.attemptCount,
    error: input.error,
  });
  const payload = {
    ...((existing?.payload ?? {}) as Record<string, unknown>),
    latestError: input.error.slice(0, 4_000),
    latestAttemptCount: input.attemptCount,
    latestBackgroundJobId: input.backgroundJobId,
    aggregationKey,
  };

  if (existing) {
    await db.update(inAppNotifications).set({
      status: state.status,
      message,
      repeatCount: state.repeatCount,
      latestFailureAt: now,
      latestAttemptCount: input.attemptCount,
      latestError: input.error.slice(0, 4_000),
      payload,
      resolvedAt: null,
    }).where(eq(inAppNotifications.id, existing.id));
    return (await db.select().from(inAppNotifications).where(eq(inAppNotifications.id, existing.id)).limit(1))[0];
  }

  const [created] = await db.insert(inAppNotifications).values({
    ownerId: project.ownerId,
    projectId: input.projectId,
    backgroundJobId: input.backgroundJobId,
    type: "BACKGROUND_JOB_FAILED",
    severity: "ERROR",
    status: state.status,
    title,
    message,
    aggregationKey,
    repeatCount: state.repeatCount,
    latestFailureAt: now,
    latestAttemptCount: input.attemptCount,
    latestError: input.error.slice(0, 4_000),
    payload,
  }).$returningId();
  return (await db.select().from(inAppNotifications).where(eq(inAppNotifications.id, created.id)).limit(1))[0];
}

export async function listNotificationsForOwner(ownerId: number) {
  const db = await requireDb();
  return db.select().from(inAppNotifications).where(eq(inAppNotifications.ownerId, ownerId)).orderBy(desc(inAppNotifications.createdAt)).limit(100);
}

export async function listUnreadNotificationsForOwner(ownerId: number) {
  const db = await requireDb();
  return db.select().from(inAppNotifications).where(and(
    eq(inAppNotifications.ownerId, ownerId),
    eq(inAppNotifications.status, "UNREAD")
  )).orderBy(desc(inAppNotifications.createdAt)).limit(100);
}

export async function acknowledgeNotification(input: { notificationId: number; ownerId: number }) {
  const db = await requireDb();
  await db.update(inAppNotifications).set({
    status: "ACKNOWLEDGED",
    acknowledgedAt: new Date(),
  }).where(and(
    eq(inAppNotifications.id, input.notificationId),
    eq(inAppNotifications.ownerId, input.ownerId),
    eq(inAppNotifications.status, "UNREAD")
  ));
  return (await db.select().from(inAppNotifications).where(and(
    eq(inAppNotifications.id, input.notificationId),
    eq(inAppNotifications.ownerId, input.ownerId)
  )).limit(1))[0];
}

export async function resolveNotification(input: { notificationId: number; ownerId: number }) {
  const db = await requireDb();
  await db.update(inAppNotifications).set({
    status: "RESOLVED",
    resolvedAt: new Date(),
  }).where(and(
    eq(inAppNotifications.id, input.notificationId),
    eq(inAppNotifications.ownerId, input.ownerId)
  ));
  return (await db.select().from(inAppNotifications).where(and(
    eq(inAppNotifications.id, input.notificationId),
    eq(inAppNotifications.ownerId, input.ownerId)
  )).limit(1))[0];
}
