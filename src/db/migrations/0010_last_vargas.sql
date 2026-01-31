ALTER TABLE "texts" DROP CONSTRAINT "texts_project_id_lang_id_path_index_pk";--> statement-breakpoint
ALTER TABLE "texts" ADD CONSTRAINT "texts_project_id_path_index_pk" PRIMARY KEY("project_id","path","index");--> statement-breakpoint
ALTER TABLE "texts" ADD COLUMN "shloka_num" integer;--> statement-breakpoint
ALTER TABLE "texts" DROP COLUMN "lang_id";