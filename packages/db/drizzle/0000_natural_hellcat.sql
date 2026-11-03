CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expires_at_idx` ON `session` (`expires_at`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `player_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`numeric_id` text,
	`rings_balance` integer DEFAULT 0 NOT NULL,
	`lifetime_rings_earned` integer DEFAULT 0 NOT NULL,
	`lifetime_rings_spent` integer DEFAULT 0 NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`games_played` integer DEFAULT 0 NOT NULL,
	`games_won` integer DEFAULT 0 NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "player_profiles_rings_balance_non_negative" CHECK("player_profiles"."rings_balance" >= 0),
	CONSTRAINT "player_profiles_xp_non_negative" CHECK("player_profiles"."xp" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_profiles_numeric_id_unique` ON `player_profiles` (`numeric_id`);--> statement-breakpoint
CREATE TABLE `ring_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`type` text NOT NULL,
	`reason` text,
	`reference_type` text,
	`reference_id` text,
	`idempotency_key` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ring_transactions_amount_non_zero" CHECK("ring_transactions"."amount" <> 0),
	CONSTRAINT "ring_transactions_balance_after_non_negative" CHECK("ring_transactions"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ring_transactions_idempotency_key_unique` ON `ring_transactions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `ring_transactions_user_created_idx` ON `ring_transactions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `match_players` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`user_id` text,
	`seat` integer NOT NULL,
	`placement` integer,
	`xp_earned` integer DEFAULT 0 NOT NULL,
	`rings_earned` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `match_players_user_idx` ON `match_players` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `match_players_match_user_unique` ON `match_players` (`match_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`game_slug` text NOT NULL,
	`room_code` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE INDEX `matches_game_started_idx` ON `matches` (`game_slug`,`started_at`);