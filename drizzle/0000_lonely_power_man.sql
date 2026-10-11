CREATE TABLE `game_accounts` (
	`account_id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`guest_hash` text,
	`session_hash` text NOT NULL,
	`generation` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`commit_id` text NOT NULL,
	`account_json` text NOT NULL,
	`battle_json` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_accounts_owner_id_unique` ON `game_accounts` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_accounts_guest_hash_unique` ON `game_accounts` (`guest_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_accounts_session_hash_unique` ON `game_accounts` (`session_hash`);--> statement-breakpoint
CREATE TABLE `game_commands` (
	`account_id` text NOT NULL,
	`request_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`receipt_json` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`account_id`, `request_id`),
	FOREIGN KEY (`account_id`) REFERENCES `game_accounts`(`account_id`) ON UPDATE no action ON DELETE no action
);
