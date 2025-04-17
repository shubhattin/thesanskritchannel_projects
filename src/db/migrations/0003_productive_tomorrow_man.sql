DROP INDEX "media_link_index";--> statement-breakpoint
ALTER TABLE "translation" DROP CONSTRAINT "translation_project_id_lang_id_second_first_index_pk";--> statement-breakpoint
ALTER TABLE "translation" ADD CONSTRAINT "translation_project_id_lang_id_path_index_pk" PRIMARY KEY("project_id","lang_id","path","index");--> statement-breakpoint
ALTER TABLE "media_attachment" ADD COLUMN "path" text NOT NULL;--> statement-breakpoint
ALTER TABLE "translation" ADD COLUMN "path" text NOT NULL;--> statement-breakpoint
CREATE INDEX "media_link_index" ON "media_attachment" USING btree ("project_id","path");--> statement-breakpoint
ALTER TABLE "media_attachment" DROP COLUMN "second";--> statement-breakpoint
ALTER TABLE "media_attachment" DROP COLUMN "first";--> statement-breakpoint
ALTER TABLE "translation" DROP COLUMN "second";--> statement-breakpoint
ALTER TABLE "translation" DROP COLUMN "first";