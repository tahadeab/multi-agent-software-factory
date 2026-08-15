ALTER TABLE `inAppNotifications` ADD `aggregationKey` varchar(255) NULL;--> statement-breakpoint
ALTER TABLE `inAppNotifications` ADD `repeatCount` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `inAppNotifications` ADD `latestFailureAt` timestamp NULL;--> statement-breakpoint
ALTER TABLE `inAppNotifications` ADD `latestAttemptCount` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `inAppNotifications` ADD `latestError` text NULL;--> statement-breakpoint
UPDATE `inAppNotifications` SET `aggregationKey` = CONCAT('legacy:', `id`), `latestFailureAt` = `createdAt`, `latestError` = `message` WHERE `aggregationKey` IS NULL;--> statement-breakpoint
ALTER TABLE `inAppNotifications` MODIFY `aggregationKey` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `inAppNotifications` MODIFY `latestFailureAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `inAppNotifications` MODIFY `latestError` text NOT NULL;--> statement-breakpoint
ALTER TABLE `inAppNotifications` ADD CONSTRAINT `notifications_aggregation_key_idx` UNIQUE(`aggregationKey`);--> statement-breakpoint
