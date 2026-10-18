CREATE TABLE "site_lekha_redirects" (
	"id" serial PRIMARY KEY NOT NULL,
	"lekha_id" integer NOT NULL,
	"url_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_lekha_redirects_url_slug_unique" UNIQUE("url_slug")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "uid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "site_lekhas" ADD COLUMN "uid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "site_lekha_redirects" ADD CONSTRAINT "site_lekha_redirects_lekha_id_site_lekhas_id_fk" FOREIGN KEY ("lekha_id") REFERENCES "public"."site_lekhas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_uid_unique" UNIQUE("uid");--> statement-breakpoint
ALTER TABLE "site_lekhas" ADD CONSTRAINT "site_lekhas_uid_unique" UNIQUE("uid");