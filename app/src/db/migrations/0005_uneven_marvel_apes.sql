CREATE TYPE "public"."app_scope" AS ENUM('projects_portal', 'padavali');--> statement-breakpoint
CREATE TABLE "user_app_scope_join" (
	"user_id" text NOT NULL,
	"scope" "app_scope" NOT NULL,
	CONSTRAINT "user_app_scope_join_user_id_scope_pk" PRIMARY KEY("user_id","scope")
);
--> statement-breakpoint
ALTER TABLE "user_app_scope_join" ADD CONSTRAINT "user_app_scope_join_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "is_approved";