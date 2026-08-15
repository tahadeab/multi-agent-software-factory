import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import {
  AGENT_IDS,
  AGENT_RUN_STATES,
  APPROVAL_ACTIONS,
  BACKGROUND_JOB_STATUSES,
  BACKGROUND_JOB_TYPES,
  EVENT_TYPES,
  IN_APP_NOTIFICATION_SEVERITIES,
  IN_APP_NOTIFICATION_STATUSES,
  IN_APP_NOTIFICATION_TYPES,
  PROJECT_STATES,
} from "../shared/factory";

/** Core identity table backing the authenticated user flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 160 }).notNull(),
    rawRequirement: text("rawRequirement").notNull(),
    status: mysqlEnum("status", PROJECT_STATES).default("DRAFT").notNull(),
    progress: int("progress").default(0).notNull(),
    currentPhase: varchar("currentPhase", { length: 80 }).default("Intake").notNull(),
    settings: json("settings").$type<Record<string, unknown>>().notNull(),
    sharedState: json("sharedState").$type<Record<string, unknown>>().notNull(),
    repositoryUrl: varchar("repositoryUrl", { length: 1_024 }),
    repositoryBranch: varchar("repositoryBranch", { length: 255 }),
    currentCommit: varchar("currentCommit", { length: 255 }),
    ciStatus: varchar("ciStatus", { length: 80 }),
    deploymentStatus: varchar("deploymentStatus", { length: 80 }),
    deploymentUrl: varchar("deploymentUrl", { length: 1_024 }),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  },
  table => [
    index("projects_owner_updated_idx").on(table.ownerId, table.updatedAt),
    index("projects_status_activity_idx").on(table.status, table.lastActivityAt),
  ]
);

export const requirements = mysqlTable(
  "requirements",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    version: int("version").default(1).notNull(),
    status: varchar("status", { length: 40 }).default("DRAFT").notNull(),
    structured: json("structured").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("requirements_project_version_idx").on(table.projectId, table.version),
    index("requirements_project_idx").on(table.projectId),
  ]
);

export const projectTasks = mysqlTable(
  "projectTasks",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    agentId: mysqlEnum("agentId", AGENT_IDS).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    status: mysqlEnum("status", AGENT_RUN_STATES).default("WAITING").notNull(),
    priority: varchar("priority", { length: 24 }).default("medium").notNull(),
    dependencies: json("dependencies").$type<number[]>().notNull(),
    attemptCount: int("attemptCount").default(0).notNull(),
    maxAttempts: int("maxAttempts").default(3).notNull(),
    reviewIteration: int("reviewIteration").default(0).notNull(),
    maxReviewIterations: int("maxReviewIterations").default(3).notNull(),
    output: json("output").$type<Record<string, unknown> | null>(),
    error: text("error"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("tasks_project_agent_idx").on(table.projectId, table.agentId),
    index("tasks_project_status_idx").on(table.projectId, table.status),
  ]
);

export const agents = mysqlTable(
  "agents",
  {
    id: int("id").autoincrement().primaryKey(),
    agentId: mysqlEnum("agentId", AGENT_IDS).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description").notNull(),
    toolPermissions: json("toolPermissions").$type<string[]>().notNull(),
    inputSchema: json("inputSchema").$type<Record<string, unknown>>().notNull(),
    outputSchema: json("outputSchema").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("agents_agent_id_idx").on(table.agentId)]
);

export const agentRuns = mysqlTable(
  "agentRuns",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    taskId: int("taskId")
      .notNull()
      .references(() => projectTasks.id),
    agentId: mysqlEnum("agentId", AGENT_IDS).notNull(),
    status: mysqlEnum("status", AGENT_RUN_STATES).default("WAITING").notNull(),
    attempt: int("attempt").default(1).notNull(),
    model: varchar("model", { length: 160 }),
    input: json("input").$type<Record<string, unknown>>().notNull(),
    output: json("output").$type<Record<string, unknown> | null>(),
    toolCalls: json("toolCalls").$type<Array<Record<string, unknown>>>().notNull(),
    error: text("error"),
    promptTokens: int("promptTokens"),
    completionTokens: int("completionTokens"),
    totalTokens: int("totalTokens"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("agent_runs_project_created_idx").on(table.projectId, table.createdAt),
    index("agent_runs_task_idx").on(table.taskId),
    index("agent_runs_status_idx").on(table.status),
  ]
);

export const agentMessages = mysqlTable(
  "agentMessages",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    fromAgent: mysqlEnum("fromAgent", AGENT_IDS).notNull(),
    toAgent: mysqlEnum("toAgent", AGENT_IDS).notNull(),
    messageType: varchar("messageType", { length: 100 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("agent_messages_project_created_idx").on(table.projectId, table.createdAt)]
);

export const artifacts = mysqlTable(
  "artifacts",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    agentRunId: int("agentRunId").references(() => agentRuns.id),
    kind: varchar("kind", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    storageKey: varchar("storageKey", { length: 1_024 }).notNull(),
    storageUrl: varchar("storageUrl", { length: 1_024 }).notNull(),
    contentType: varchar("contentType", { length: 160 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("artifacts_project_created_idx").on(table.projectId, table.createdAt),
    index("artifacts_run_idx").on(table.agentRunId),
  ]
);

export const architectureDecisions = mysqlTable(
  "architectureDecisions",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    title: varchar("title", { length: 255 }).notNull(),
    status: varchar("status", { length: 40 }).default("PROPOSED").notNull(),
    context: text("context").notNull(),
    decision: text("decision").notNull(),
    rationale: text("rationale").notNull(),
    tradeoffs: text("tradeoffs").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("architecture_decisions_project_idx").on(table.projectId)]
);

export const researchSources = mysqlTable(
  "researchSources",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    title: varchar("title", { length: 500 }).notNull(),
    url: varchar("url", { length: 1_024 }).notNull(),
    publisher: varchar("publisher", { length: 255 }),
    summary: text("summary").notNull(),
    relevance: text("relevance").notNull(),
    retrievedAt: timestamp("retrievedAt").defaultNow().notNull(),
  },
  table => [index("research_sources_project_idx").on(table.projectId)]
);

export const reviews = mysqlTable(
  "reviews",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    agentRunId: int("agentRunId").references(() => agentRuns.id),
    severity: varchar("severity", { length: 24 }).notNull(),
    file: varchar("file", { length: 1_024 }),
    line: int("line"),
    issue: text("issue").notNull(),
    recommendation: text("recommendation").notNull(),
    status: varchar("status", { length: 40 }).default("OPEN").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("reviews_project_status_idx").on(table.projectId, table.status)]
);

export const securityFindings = mysqlTable(
  "securityFindings",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    agentRunId: int("agentRunId").references(() => agentRuns.id),
    severity: varchar("severity", { length: 24 }).notNull(),
    category: varchar("category", { length: 120 }).notNull(),
    file: varchar("file", { length: 1_024 }),
    line: int("line"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    remediation: text("remediation").notNull(),
    status: varchar("status", { length: 40 }).default("OPEN").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("security_findings_project_status_idx").on(table.projectId, table.status)]
);

export const ciRuns = mysqlTable(
  "ciRuns",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    provider: varchar("provider", { length: 100 }).notNull(),
    externalRunId: varchar("externalRunId", { length: 255 }),
    status: varchar("status", { length: 80 }).notNull(),
    summary: text("summary"),
    url: varchar("url", { length: 1_024 }),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("ci_runs_project_created_idx").on(table.projectId, table.createdAt)]
);

export const deployments = mysqlTable(
  "deployments",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    provider: varchar("provider", { length: 100 }).notNull(),
    environment: varchar("environment", { length: 80 }).notNull(),
    status: varchar("status", { length: 80 }).notNull(),
    url: varchar("url", { length: 1_024 }),
    rollbackReference: varchar("rollbackReference", { length: 255 }),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("deployments_project_created_idx").on(table.projectId, table.createdAt)]
);

/** Durable queue for workflow work that outlives the originating HTTP request. */
export const backgroundJobs = mysqlTable(
  "backgroundJobs",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    jobType: mysqlEnum("jobType", BACKGROUND_JOB_TYPES).notNull(),
    dedupeKey: varchar("dedupeKey", { length: 160 }).notNull(),
    status: mysqlEnum("status", BACKGROUND_JOB_STATUSES).default("QUEUED").notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    priority: int("priority").default(100).notNull(),
    attemptCount: int("attemptCount").default(0).notNull(),
    maxAttempts: int("maxAttempts").default(8).notNull(),
    availableAt: timestamp("availableAt").defaultNow().notNull(),
    leaseOwner: varchar("leaseOwner", { length: 160 }),
    leaseExpiresAt: timestamp("leaseExpiresAt"),
    lastError: text("lastError"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("background_jobs_project_dedupe_idx").on(table.projectId, table.dedupeKey),
    index("background_jobs_status_available_idx").on(table.status, table.availableAt),
    index("background_jobs_lease_idx").on(table.leaseExpiresAt),
  ]
);

/** Owner-scoped inbox for actionable system failures and workflow alerts. */
export const inAppNotifications = mysqlTable(
  "inAppNotifications",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId")
      .notNull()
      .references(() => users.id),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    backgroundJobId: int("backgroundJobId").references(() => backgroundJobs.id),
    type: mysqlEnum("type", IN_APP_NOTIFICATION_TYPES).notNull(),
    severity: mysqlEnum("severity", IN_APP_NOTIFICATION_SEVERITIES).notNull(),
    status: mysqlEnum("status", IN_APP_NOTIFICATION_STATUSES).default("UNREAD").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    aggregationKey: varchar("aggregationKey", { length: 255 }).notNull(),
    repeatCount: int("repeatCount").default(1).notNull(),
    latestFailureAt: timestamp("latestFailureAt").defaultNow().notNull(),
    latestAttemptCount: int("latestAttemptCount").default(1).notNull(),
    latestError: text("latestError").notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    acknowledgedAt: timestamp("acknowledgedAt"),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("notifications_aggregation_key_idx").on(table.aggregationKey),
    index("notifications_owner_status_created_idx").on(table.ownerId, table.status, table.createdAt),
    index("notifications_project_created_idx").on(table.projectId, table.createdAt),
    index("notifications_background_job_idx").on(table.backgroundJobId),
  ]
);

export const events = mysqlTable(
  "events",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    agentRunId: int("agentRunId").references(() => agentRuns.id),
    eventType: mysqlEnum("eventType", EVENT_TYPES).notNull(),
    actor: varchar("actor", { length: 160 }).notNull(),
    summary: varchar("summary", { length: 500 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("events_project_created_idx").on(table.projectId, table.createdAt),
    index("events_type_idx").on(table.eventType),
  ]
);

export const approvals = mysqlTable(
  "approvals",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id),
    action: mysqlEnum("action", APPROVAL_ACTIONS).notNull(),
    requestedBy: varchar("requestedBy", { length: 160 }).notNull(),
    requestedAction: text("requestedAction").notNull(),
    rationale: text("rationale").notNull(),
    status: varchar("status", { length: 40 }).default("AWAITING_HUMAN_APPROVAL").notNull(),
    resolvedByUserId: int("resolvedByUserId").references(() => users.id),
    resolutionNote: text("resolutionNote"),
    requestedAt: timestamp("requestedAt").defaultNow().notNull(),
    resolvedAt: timestamp("resolvedAt"),
  },
  table => [
    index("approvals_project_status_idx").on(table.projectId, table.status),
    index("approvals_action_idx").on(table.action),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type FactoryEvent = typeof events.$inferSelect;
export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type InAppNotification = typeof inAppNotifications.$inferSelect;
