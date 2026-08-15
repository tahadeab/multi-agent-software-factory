CREATE TABLE `agentMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`fromAgent` enum('requirements','planner','architect','research','database','developer','testing','security','reviewer','documentation','github','deployment') NOT NULL,
	`toAgent` enum('requirements','planner','architect','research','database','developer','testing','security','reviewer','documentation','github','deployment') NOT NULL,
	`messageType` varchar(100) NOT NULL,
	`payload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`taskId` int NOT NULL,
	`agentId` enum('requirements','planner','architect','research','database','developer','testing','security','reviewer','documentation','github','deployment') NOT NULL,
	`status` enum('WAITING','RUNNING','RETRYING','SUCCEEDED','FAILED','BLOCKED','SKIPPED') NOT NULL DEFAULT 'WAITING',
	`attempt` int NOT NULL DEFAULT 1,
	`model` varchar(160),
	`input` json NOT NULL,
	`output` json,
	`toolCalls` json NOT NULL,
	`error` text,
	`promptTokens` int,
	`completionTokens` int,
	`totalTokens` int,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` enum('requirements','planner','architect','research','database','developer','testing','security','reviewer','documentation','github','deployment') NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`toolPermissions` json NOT NULL,
	`inputSchema` json NOT NULL,
	`outputSchema` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `agents_agent_id_idx` UNIQUE(`agentId`)
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`action` enum('ARCHITECTURE_APPROVAL','REPOSITORY_CREATION','EXTERNAL_API_COST','DESTRUCTIVE_DATABASE_MIGRATION','PRODUCTION_DEPLOYMENT') NOT NULL,
	`requestedBy` varchar(160) NOT NULL,
	`requestedAction` text NOT NULL,
	`rationale` text NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'AWAITING_HUMAN_APPROVAL',
	`resolvedByUserId` int,
	`resolutionNote` text,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `architectureDecisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'PROPOSED',
	`context` text NOT NULL,
	`decision` text NOT NULL,
	`rationale` text NOT NULL,
	`tradeoffs` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `architectureDecisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`agentRunId` int,
	`kind` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`storageKey` varchar(1024) NOT NULL,
	`storageUrl` varchar(1024) NOT NULL,
	`contentType` varchar(160) NOT NULL,
	`sizeBytes` int NOT NULL,
	`metadata` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ciRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`provider` varchar(100) NOT NULL,
	`externalRunId` varchar(255),
	`status` varchar(80) NOT NULL,
	`summary` text,
	`url` varchar(1024),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ciRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`provider` varchar(100) NOT NULL,
	`environment` varchar(80) NOT NULL,
	`status` varchar(80) NOT NULL,
	`url` varchar(1024),
	`rollbackReference` varchar(255),
	`metadata` json NOT NULL,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deployments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`agentRunId` int,
	`eventType` enum('PROJECT_CREATED','PROJECT_UPDATED','PLAN_CREATED','TASK_CREATED','TASK_COMPLETED','AGENT_STARTED','AGENT_COMPLETED','AGENT_FAILED','AGENT_RETRYING','REVIEW_REQUESTED','REVIEW_FAILED','REVIEW_APPROVED','APPROVAL_REQUESTED','APPROVAL_GRANTED','APPROVAL_REJECTED','CI_STARTED','CI_FAILED','CI_PASSED','DEPLOYMENT_REQUESTED','DEPLOYMENT_APPROVED','DEPLOYMENT_COMPLETED','WORKFLOW_PAUSED','WORKFLOW_RESUMED','WORKFLOW_COMPLETED','WORKFLOW_FAILED') NOT NULL,
	`actor` varchar(160) NOT NULL,
	`summary` varchar(500) NOT NULL,
	`payload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`agentId` enum('requirements','planner','architect','research','database','developer','testing','security','reviewer','documentation','github','deployment') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`status` enum('WAITING','RUNNING','RETRYING','SUCCEEDED','FAILED','BLOCKED','SKIPPED') NOT NULL DEFAULT 'WAITING',
	`priority` varchar(24) NOT NULL DEFAULT 'medium',
	`dependencies` json NOT NULL,
	`attemptCount` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`reviewIteration` int NOT NULL DEFAULT 0,
	`maxReviewIterations` int NOT NULL DEFAULT 3,
	`output` json,
	`error` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectTasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `tasks_project_agent_idx` UNIQUE(`projectId`,`agentId`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`rawRequirement` text NOT NULL,
	`status` enum('DRAFT','PLANNING','ARCHITECTURE','RESEARCH','DATABASE_DESIGN','IMPLEMENTATION','TESTING','SECURITY_REVIEW','CODE_REVIEW','DOCUMENTATION','GITHUB','CI','DEPLOYMENT','AWAITING_HUMAN_APPROVAL','PAUSED','COMPLETED','FAILED') NOT NULL DEFAULT 'DRAFT',
	`progress` int NOT NULL DEFAULT 0,
	`currentPhase` varchar(80) NOT NULL DEFAULT 'Intake',
	`settings` json NOT NULL,
	`sharedState` json NOT NULL,
	`repositoryUrl` varchar(1024),
	`repositoryBranch` varchar(255),
	`currentCommit` varchar(255),
	`ciStatus` varchar(80),
	`deploymentStatus` varchar(80),
	`deploymentUrl` varchar(1024),
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `requirements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` varchar(40) NOT NULL DEFAULT 'DRAFT',
	`structured` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `requirements_id` PRIMARY KEY(`id`),
	CONSTRAINT `requirements_project_version_idx` UNIQUE(`projectId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `researchSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`publisher` varchar(255),
	`summary` text NOT NULL,
	`relevance` text NOT NULL,
	`retrievedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `researchSources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`agentRunId` int,
	`severity` varchar(24) NOT NULL,
	`file` varchar(1024),
	`line` int,
	`issue` text NOT NULL,
	`recommendation` text NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'OPEN',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `securityFindings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`agentRunId` int,
	`severity` varchar(24) NOT NULL,
	`category` varchar(120) NOT NULL,
	`file` varchar(1024),
	`line` int,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`remediation` text NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'OPEN',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `securityFindings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agentMessages` ADD CONSTRAINT `agentMessages_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentRuns` ADD CONSTRAINT `agentRuns_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agentRuns` ADD CONSTRAINT `agentRuns_taskId_projectTasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `projectTasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_resolvedByUserId_users_id_fk` FOREIGN KEY (`resolvedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `architectureDecisions` ADD CONSTRAINT `architectureDecisions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artifacts` ADD CONSTRAINT `artifacts_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `artifacts` ADD CONSTRAINT `artifacts_agentRunId_agentRuns_id_fk` FOREIGN KEY (`agentRunId`) REFERENCES `agentRuns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ciRuns` ADD CONSTRAINT `ciRuns_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deployments` ADD CONSTRAINT `deployments_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_agentRunId_agentRuns_id_fk` FOREIGN KEY (`agentRunId`) REFERENCES `agentRuns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectTasks` ADD CONSTRAINT `projectTasks_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requirements` ADD CONSTRAINT `requirements_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `researchSources` ADD CONSTRAINT `researchSources_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_agentRunId_agentRuns_id_fk` FOREIGN KEY (`agentRunId`) REFERENCES `agentRuns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `securityFindings` ADD CONSTRAINT `securityFindings_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `securityFindings` ADD CONSTRAINT `securityFindings_agentRunId_agentRuns_id_fk` FOREIGN KEY (`agentRunId`) REFERENCES `agentRuns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_messages_project_created_idx` ON `agentMessages` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agent_runs_project_created_idx` ON `agentRuns` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `agent_runs_task_idx` ON `agentRuns` (`taskId`);--> statement-breakpoint
CREATE INDEX `agent_runs_status_idx` ON `agentRuns` (`status`);--> statement-breakpoint
CREATE INDEX `approvals_project_status_idx` ON `approvals` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `approvals_action_idx` ON `approvals` (`action`);--> statement-breakpoint
CREATE INDEX `architecture_decisions_project_idx` ON `architectureDecisions` (`projectId`);--> statement-breakpoint
CREATE INDEX `artifacts_project_created_idx` ON `artifacts` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `artifacts_run_idx` ON `artifacts` (`agentRunId`);--> statement-breakpoint
CREATE INDEX `ci_runs_project_created_idx` ON `ciRuns` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `deployments_project_created_idx` ON `deployments` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `events_project_created_idx` ON `events` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `events_type_idx` ON `events` (`eventType`);--> statement-breakpoint
CREATE INDEX `tasks_project_status_idx` ON `projectTasks` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `projects_owner_updated_idx` ON `projects` (`ownerId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `projects_status_activity_idx` ON `projects` (`status`,`lastActivityAt`);--> statement-breakpoint
CREATE INDEX `requirements_project_idx` ON `requirements` (`projectId`);--> statement-breakpoint
CREATE INDEX `research_sources_project_idx` ON `researchSources` (`projectId`);--> statement-breakpoint
CREATE INDEX `reviews_project_status_idx` ON `reviews` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `security_findings_project_status_idx` ON `securityFindings` (`projectId`,`status`);