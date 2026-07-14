CREATE TABLE `youtubeBookmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`videoId` varchar(64) NOT NULL,
	`contentType` enum('video','shorts') NOT NULL,
	`title` text NOT NULL,
	`thumbnailUrl` text,
	`channelId` varchar(64),
	`channelTitle` varchar(255),
	`channelThumbnailUrl` text,
	`videoUrl` text,
	`duration` varchar(32),
	`viewCount` varchar(32),
	`publishedAt` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `youtubeBookmarks_id` PRIMARY KEY(`id`),
	CONSTRAINT `youtubeBookmarks_userVideoUnique` UNIQUE(`userId`, `videoId`, `contentType`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `memberNo` int NOT NULL;