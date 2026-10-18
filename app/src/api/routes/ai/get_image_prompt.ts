import { Effect } from 'effect';
import { protectedAdminProcedure } from '~/api/trpc_init';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { DEFAULT_TEXT_AI_MODEL, text_models_enum } from './ai_types';
import { format_string_text } from '~/tools/kry';
import { CACHE } from '~/utils/cache.server/cached_loader.server';
import { get_project_by_key, get_project_info_by_id } from '~/utils/project/list.server';
import { get_path_params } from '~/state/project_list';
import { lang_list_obj } from '~/state/lang_list';
import { text_model_custom_options, resolveOpenRouterTextModel } from './providers';
import { runTrpcEffect } from '~/effect/app_runtime.server';
import { dbRun } from '~/effect/database';
import { DEFAULT_IMAGE_SYSTEM_PROMPT } from './image_prompt_defaults';
import { BadRequestError, NotFoundError } from '~/effect/errors';

/**
 * Built-in default system prompt for image-prompt generation.
 * Re-exported from the import-safe defaults module (browser components
 * must import from there, never from this server route module).
 */
export {
  DEFAULT_IMAGE_SYSTEM_PROMPT_TITLE,
  DEFAULT_IMAGE_SYSTEM_PROMPT
} from './image_prompt_defaults';

const IMAGE_USER_PROMPT = `
This Shloka is from {text_info} of {text_name}.

{shloka_text}
`.trim();

const IMAGE_CUSTOM_INSTRUCTION_PROMPT = `
Custom instructions for Image Generation:
{custom_instruction}
`.trim();

export const get_image_prompt_input_schema = z.object({
  project_key: z.string(),
  selected_text_levels: z.array(z.int().nullable()),
  index: z.int().min(0),
  model: text_models_enum.default(DEFAULT_TEXT_AI_MODEL),
  custom_instruction: z.string().optional(),
  /** DB template id; null/omitted = built-in default. */
  system_prompt_template_id: z.int().nullable().optional(),
  /**
   * Pre-resolved template content + title (batch path fetches once and shares).
   * When present the DB lookup is skipped; blank content fails like an empty template.
   */
  system_prompt_override: z.string().optional(),
  system_prompt_override_title: z.string().nullable().optional()
});

export type GetImagePromptInput = z.infer<typeof get_image_prompt_input_schema>;

/** Resolve the injectable system-prompt base: template content or built-in default. */
/** Domain Effect — run only at a HTTP/tRPC boundary. */
export const get_image_prompt_func = (input: GetImagePromptInput) =>
  Effect.gen(function* () {
    const {
      project_key,
      selected_text_levels,
      index,
      model,
      custom_instruction,
      system_prompt_template_id,
      system_prompt_override,
      system_prompt_override_title
    } = input;

    const null_result = {
      image_prompt: null,
      time_taken: 0,
      system_prompt_used: null,
      system_prompt_template_id: system_prompt_template_id ?? null,
      system_prompt_template_title: null
    };

    const project = yield* get_project_by_key(project_key);
    if (!project) return null_result;

    const project_info = yield* get_project_info_by_id(project.id);
    const path_params = get_path_params(selected_text_levels, project_info.levels);
    const [text_data, translations] = yield* Effect.all(
      [
        CACHE.text_data.get({ key: project_key, path_params }),
        CACHE.translation.get({
          project_id: project.id,
          lang_id: lang_list_obj.English,
          selected_text_levels
        })
      ],
      { concurrency: 'unbounded' }
    );
    const shloka = text_data[index];
    if (!shloka) return null_result;

    let shloka_text = shloka.text;
    const english_translation = translations.get(index);
    if (english_translation) shloka_text += '\n\n' + english_translation;

    const list_level_names = project_info.level_names.slice(1);
    const text_info = path_params.map((param, i) => `${list_level_names[i]} ${param}`).join(', ');

    let prompt = format_string_text(IMAGE_USER_PROMPT, {
      text_name: project.name,
      text_info,
      shloka_text
    });
    const trimmed_custom = custom_instruction?.trim();
    if (trimmed_custom) {
      prompt +=
        '\n\n' +
        format_string_text(IMAGE_CUSTOM_INSTRUCTION_PROMPT, {
          custom_instruction: trimmed_custom
        });
    }

    const modelInstance = yield* resolveOpenRouterTextModel(model);
    // Fail fast on a deleted or empty template: silently falling back would burn
    // real model spend on the wrong prompt while metadata claims the template id.
    let system_prompt = DEFAULT_IMAGE_SYSTEM_PROMPT;
    let system_prompt_template_title: string | null = null;
    if (system_prompt_override !== undefined) {
      const trimmed = system_prompt_override.trim();
      if (!trimmed) {
        return yield* Effect.fail(
          BadRequestError.make({ message: 'The selected system prompt template is empty' })
        );
      }
      system_prompt = trimmed;
      system_prompt_template_title = system_prompt_override_title ?? null;
    } else if (system_prompt_template_id != null) {
      const template = yield* dbRun('get_image_prompt.template', (db) =>
        db.query.image_system_prompt_templates.findFirst({
          where: (tbl, { eq: eqOp }) => eqOp(tbl.id, system_prompt_template_id)
        })
      );
      if (!template) {
        return yield* Effect.fail(
          NotFoundError.make({
            resource: 'system_prompt_template',
            message: 'System prompt template not found'
          })
        );
      }
      const trimmed = template.content.trim();
      if (!trimmed) {
        return yield* Effect.fail(
          BadRequestError.make({
            message: `System prompt template "${template.title}" is empty`
          })
        );
      }
      system_prompt = trimmed;
      system_prompt_template_title = template.title;
    }
    return yield* Effect.promise(async () => {
      try {
        const time_start = Date.now();
        const result = await generateText({
          model: modelInstance,
          instructions: system_prompt,
          ...text_model_custom_options[model],
          prompt,
          output: Output.object({
            schema: z.object({
              image_prompt: z
                .string()
                .describe('A single detailed English image prompt for an aesthetic illustration.')
            })
          })
        });
        return {
          image_prompt: result.output.image_prompt,
          time_taken: Date.now() - time_start,
          system_prompt_used: system_prompt,
          system_prompt_template_id: system_prompt_template_id ?? null,
          system_prompt_template_title
        };
      } catch (e) {
        console.error(e);
        return { ...null_result };
      }
    });
  });

export const get_image_prompt_route = protectedAdminProcedure
  .input(get_image_prompt_input_schema)
  .query(({ input }) => runTrpcEffect(get_image_prompt_func(input)));
