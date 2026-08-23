CREATE TABLE `auth_rate_limits` (
	`key_hash` text NOT NULL,
	`action` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`key_hash`, `action`)
);
--> statement-breakpoint
CREATE INDEX `idx_auth_rate_limits_expires_at` ON `auth_rate_limits` (`expires_at`);
