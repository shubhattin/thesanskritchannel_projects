CREATE TABLE "agent_chats" (
	"id" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"user_id" text NOT NULL,
	"streaming" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"metadata" jsonb,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_chat_id_agent_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."agent_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_chats_updated_at_idx" ON "agent_chats" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "agent_messages_chat_id_position_idx" ON "agent_messages" USING btree ("chat_id","position");