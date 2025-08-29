ALTER TABLE "payments" ADD COLUMN "pi_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refund_requested" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refund_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refund_reason" text;