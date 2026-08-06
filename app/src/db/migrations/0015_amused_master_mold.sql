CREATE TABLE "project_redirects" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_redirects_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "project_redirects" ADD CONSTRAINT "project_redirects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;