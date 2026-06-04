CREATE TABLE "project_paths" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"path" text NOT NULL,
	"prev_path" text,
	"updated_at" timestamp with time zone,
	CONSTRAINT "project_paths_project_id_path_unique" UNIQUE("project_id","path")
);
--> statement-breakpoint
ALTER TABLE "media_attachment" DROP CONSTRAINT "media_attachment_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "texts" DROP CONSTRAINT "texts_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "translations" DROP CONSTRAINT "translations_project_id_projects_id_fk";
--> statement-breakpoint
DROP INDEX "media_attachment_project_id_path_index";--> statement-breakpoint
ALTER TABLE "texts" DROP CONSTRAINT "texts_project_id_path_index_pk";--> statement-breakpoint
ALTER TABLE "translations" DROP CONSTRAINT "translations_project_id_lang_id_path_index_pk";--> statement-breakpoint
ALTER TABLE "media_attachment" ALTER COLUMN "lang_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "texts" ADD CONSTRAINT "texts_project_path_id_index_pk" PRIMARY KEY("project_path_id","index");--> statement-breakpoint
ALTER TABLE "translations" ADD CONSTRAINT "translations_project_path_id_lang_id_index_pk" PRIMARY KEY("project_path_id","lang_id","index");--> statement-breakpoint
ALTER TABLE "media_attachment" ADD COLUMN "project_path_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "media_attachment" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "site_lekhas" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "texts" ADD COLUMN "project_path_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "texts" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "translations" ADD COLUMN "project_path_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "translations" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_paths" ADD CONSTRAINT "project_paths_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_paths_project_id_path_prefix_idx" ON "project_paths" USING btree ("project_id","path" text_ops);--> statement-breakpoint
ALTER TABLE "media_attachment" ADD CONSTRAINT "media_attachment_project_path_id_project_paths_id_fk" FOREIGN KEY ("project_path_id") REFERENCES "public"."project_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "texts" ADD CONSTRAINT "texts_project_path_id_project_paths_id_fk" FOREIGN KEY ("project_path_id") REFERENCES "public"."project_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translations" ADD CONSTRAINT "translations_project_path_id_project_paths_id_fk" FOREIGN KEY ("project_path_id") REFERENCES "public"."project_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_attachment_project_path_id_index" ON "media_attachment" USING btree ("project_path_id");--> statement-breakpoint
ALTER TABLE "media_attachment" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "media_attachment" DROP COLUMN "path";--> statement-breakpoint
ALTER TABLE "texts" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "texts" DROP COLUMN "path";--> statement-breakpoint
ALTER TABLE "translations" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "translations" DROP COLUMN "path";