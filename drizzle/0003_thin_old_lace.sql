ALTER TABLE "swap_requests" DROP CONSTRAINT "swap_requests_requested_item_id_clothing_items_id_fk";
--> statement-breakpoint
ALTER TABLE "swap_requests" DROP CONSTRAINT "swap_requests_offered_item_id_clothing_items_id_fk";
--> statement-breakpoint
ALTER TABLE "swap_requests" ALTER COLUMN "requested_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "swap_requests" ALTER COLUMN "offered_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_requested_item_id_clothing_items_id_fk" FOREIGN KEY ("requested_item_id") REFERENCES "public"."clothing_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_offered_item_id_clothing_items_id_fk" FOREIGN KEY ("offered_item_id") REFERENCES "public"."clothing_items"("id") ON DELETE set null ON UPDATE no action;