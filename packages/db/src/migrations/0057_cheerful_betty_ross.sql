ALTER TABLE "agents" ADD COLUMN "goal" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "constraints" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "memory_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "tools" jsonb DEFAULT '[]'::jsonb NOT NULL;