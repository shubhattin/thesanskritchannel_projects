CREATE TABLE "translation" (
	"project_id" integer NOT NULL,
	"lang_id" integer NOT NULL,
	"second" integer NOT NULL,
	"first" integer NOT NULL,
	"index" integer NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	CONSTRAINT "translation_project_id_lang_id_second_first_index_pk" PRIMARY KEY("project_id","lang_id","second","first","index")
);
--> statement-breakpoint
CREATE TABLE "user_project_join" (
	"user_id" text NOT NULL,
	"project_id" integer NOT NULL,
	CONSTRAINT "user_project_join_user_id_project_id_pk" PRIMARY KEY("user_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "user_project_language_join" (
	"user_id" text NOT NULL,
	"project_id" integer NOT NULL,
	"language_id" integer NOT NULL,
	CONSTRAINT "user_project_language_join_user_id_project_id_language_id_pk" PRIMARY KEY("user_id","project_id","language_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"username" text,
	"role" text,
	"banned" boolean,
	"ban_reason" text,
	"ban_expires" timestamp,
	"is_approved" boolean,
	"is_maintainer" boolean,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_project_join" ADD CONSTRAINT "user_project_join_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_project_language_join" ADD CONSTRAINT "user_project_language_join_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;