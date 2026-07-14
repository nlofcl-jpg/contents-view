ALTER TABLE `users` MODIFY COLUMN `memberNo` int NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `memberNo` int NOT NULL DEFAULT 0;