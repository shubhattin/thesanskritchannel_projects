CREATE TYPE "public"."media_type_enum" AS ENUM('pdf', 'text', 'video', 'audio');--> statement-breakpoint
CREATE TABLE "media_attachment" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"lang_id" integer NOT NULL,
	"second" integer NOT NULL,
	"first" integer NOT NULL,
	"type" "media_type_enum" NOT NULL,
	"link" text NOT NULL
);
