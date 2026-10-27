ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "numeric_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_profiles_numeric_id_unique" ON "player_profiles" ("numeric_id");
