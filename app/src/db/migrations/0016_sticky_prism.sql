ALTER TABLE "site_lekhas" ADD COLUMN "auto_transliterate_title" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_lekhas" ADD COLUMN "auto_transliterate_description" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_lekhas" ADD COLUMN "auto_transliterate_content" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_lekhas" DROP COLUMN "search_indexed";
