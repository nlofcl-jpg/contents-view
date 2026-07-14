ALTER TABLE `users` ADD `memberNo` int AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_memberNo_unique` UNIQUE(`memberNo`);