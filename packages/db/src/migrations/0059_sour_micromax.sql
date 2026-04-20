ALTER TABLE "agent_runtime_state" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_policies" ADD COLUMN "circuit_breaker_json" jsonb;