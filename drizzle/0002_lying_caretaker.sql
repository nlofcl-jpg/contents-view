ALTER TABLE `userApiKeys` ADD `testStatus` enum('untested','success','failed') DEFAULT 'untested' NOT NULL;--> statement-breakpoint
ALTER TABLE `userApiKeys` ADD `testError` text;--> statement-breakpoint
ALTER TABLE `userApiKeys` ADD `lastTestedAt` timestamp;