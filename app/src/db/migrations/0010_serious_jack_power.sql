CREATE TABLE "site_lekhas" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"url_slug" text NOT NULL,
	"content" text NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	"draft" boolean DEFAULT true NOT NULL,
	"listed" boolean DEFAULT true NOT NULL,
	"search_indexed" boolean DEFAULT true NOT NULL,
	CONSTRAINT "site_lekhas_url_slug_unique" UNIQUE("url_slug")
);
--> statement-breakpoint
DROP INDEX "media_link_index";--> statement-breakpoint
CREATE INDEX "site_lekhas_published_at_index" ON "site_lekhas" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "media_attachment_project_id_path_index" ON "media_attachment" USING btree ("project_id","path");