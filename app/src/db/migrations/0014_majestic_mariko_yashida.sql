CREATE TABLE "ai_batch_responses" (
	"batch_id" text NOT NULL,
	"custom_id" text NOT NULL,
	"auto_approved" boolean DEFAULT false NOT NULL,
	"metadata" jsonb NOT NULL,
	CONSTRAINT "ai_batch_responses_batch_id_custom_id_pk" PRIMARY KEY("batch_id","custom_id")
);
--> statement-breakpoint
CREATE TABLE "ai_batches" (
	"batch_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"output_resolved" boolean DEFAULT false NOT NULL,
	"input_file_id" text NOT NULL,
	"output_file_id" text
);
--> statement-breakpoint
CREATE TABLE "image_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" varchar(150),
	"width" smallint NOT NULL,
	"height" smallint NOT NULL,
	"s3_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_assets_s3_key_unique" UNIQUE("s3_key")
);
--> statement-breakpoint
CREATE TABLE "text_image_assets_join" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_path_id" integer NOT NULL,
	"index" integer,
	"image_asset_id" integer NOT NULL,
	CONSTRAINT "text_image_assets_join_image_asset_id_unique" UNIQUE("image_asset_id")
);
--> statement-breakpoint
ALTER TABLE "texts" ADD COLUMN "image_id" integer;--> statement-breakpoint
ALTER TABLE "ai_batch_responses" ADD CONSTRAINT "ai_batch_responses_batch_id_ai_batches_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."ai_batches"("batch_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_image_assets_join" ADD CONSTRAINT "text_image_assets_join_project_path_id_project_paths_id_fk" FOREIGN KEY ("project_path_id") REFERENCES "public"."project_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "text_image_assets_join" ADD CONSTRAINT "text_image_assets_join_image_asset_id_image_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."image_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "text_image_assets_join_project_path_id_index_idx" ON "text_image_assets_join" USING btree ("project_path_id","index");--> statement-breakpoint
ALTER TABLE "texts" ADD CONSTRAINT "texts_image_id_image_assets_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."image_assets"("id") ON DELETE set null ON UPDATE no action;