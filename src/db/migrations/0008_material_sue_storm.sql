CREATE TABLE "texts" (
	"project_id" integer NOT NULL,
	"lang_id" integer NOT NULL,
	"path" text NOT NULL,
	"index" integer NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	CONSTRAINT "texts_project_id_lang_id_path_index_pk" PRIMARY KEY("project_id","lang_id","path","index")
);
--> statement-breakpoint
ALTER TABLE "translation" RENAME TO "translations";--> statement-breakpoint
ALTER TABLE "translations" DROP CONSTRAINT "translation_project_id_lang_id_path_index_pk";--> statement-breakpoint
ALTER TABLE "translations" ADD CONSTRAINT "translations_project_id_lang_id_path_index_pk" PRIMARY KEY("project_id","lang_id","path","index");