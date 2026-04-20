ALTER TABLE "agent_wakeup_requests" ADD COLUMN "wake_reason" text;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "wake_reason" text;--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "goal";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "constraints";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "memory_settings";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "tools";