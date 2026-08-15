CREATE TABLE `inAppNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`projectId` int NOT NULL,
	`backgroundJobId` int,
	`type` enum('BACKGROUND_JOB_FAILED') NOT NULL,
	`severity` enum('ERROR') NOT NULL,
	`status` enum('UNREAD','ACKNOWLEDGED','RESOLVED') NOT NULL DEFAULT 'UNREAD',
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`payload` json NOT NULL,
	`acknowledgedAt` timestamp,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inAppNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `inAppNotifications` ADD CONSTRAINT `inAppNotifications_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inAppNotifications` ADD CONSTRAINT `inAppNotifications_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inAppNotifications` ADD CONSTRAINT `inAppNotifications_backgroundJobId_backgroundJobs_id_fk` FOREIGN KEY (`backgroundJobId`) REFERENCES `backgroundJobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notifications_owner_status_created_idx` ON `inAppNotifications` (`ownerId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_project_created_idx` ON `inAppNotifications` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_background_job_idx` ON `inAppNotifications` (`backgroundJobId`);