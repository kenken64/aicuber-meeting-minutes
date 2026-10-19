CREATE TABLE `zoom_connections` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`zoom_user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`token_cipher` text NOT NULL,
	`expires_at` integer NOT NULL,
	`refresh_owner` text,
	`refresh_until` integer
);
--> statement-breakpoint
CREATE INDEX `zoom_user_index` ON `zoom_connections` (`zoom_user_id`);--> statement-breakpoint
CREATE TABLE `zoom_oauth_states` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`browser_hash` text NOT NULL,
	`expires_at` integer NOT NULL
);
