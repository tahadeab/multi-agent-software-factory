CREATE TABLE `backgroundJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`jobType` enum('WORKFLOW_ADVANCE') NOT NULL,
	`dedupeKey` varchar(160) NOT NULL,
	`status` enum('QUEUED','LEASED','SUCCEEDED','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
	`payload` json NOT NULL,
	`priority` int NOT NULL DEFAULT 100,
	`attemptCount` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 8,
	`availableAt` timestamp NOT NULL DEFAULT (now()),
	`leaseOwner` varchar(160),
	`leaseExpiresAt` timestamp,
	`lastError` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backgroundJobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `background_jobs_project_dedupe_idx` UNIQUE(`projectId`,`dedupeKey`)
);
--> statement-breakpoint
ALTER TABLE `events` MODIFY COLUMN `eventType` enum('PROJECT_CREATED','PROJECT_UPDATED','PLAN_CREATED','TASK_CREATED','TASK_COMPLETED','AGENT_STARTED','AGENT_COMPLETED','AGENT_FAILED','AGENT_RETRYING','REVIEW_REQUESTED','REVIEW_FAILED','REVIEW_APPROVED','APPROVAL_REQUESTED','APPROVAL_GRANTED','APPROVAL_REJECTED','CI_STARTED','CI_FAILED','CI_PASSED','DEPLOYMENT_REQUESTED','DEPLOYMENT_APPROVED','DEPLOYMENT_COMPLETED','WORKFLOW_PAUSED','WORKFLOW_RESUMED','WORKFLOW_QUEUED','WORKER_STARTED','WORKER_CLAIMED_JOB','WORKER_COMPLETED_JOB','WORKER_FAILED_JOB','WORKER_RECOVERED_LEASE','WORKFLOW_COMPLETED','WORKFLOW_FAILED') NOT NULL;--> statement-breakpoint
ALTER TABLE `backgroundJobs` ADD CONSTRAINT `backgroundJobs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `background_jobs_status_available_idx` ON `backgroundJobs` (`status`,`availableAt`);--> statement-breakpoint
CREATE INDEX `background_jobs_lease_idx` ON `backgroundJobs` (`leaseExpiresAt`);