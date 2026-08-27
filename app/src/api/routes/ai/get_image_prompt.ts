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

const IMAGE_SYSTEM_PROMPT = `
You write image-generation prompts for Sanskrit scripture content meant to look beautiful.
It will be used in multiple places like as a backgound image to shlokas on and so on.

You will receive a Sanskrit shloka and, when available, its English translation. Produce one detailed English image prompt that captures the essence of the meaning.

The user message may also include custom instructions. When present, honor them while writing the image prompt — combine them with the art direction below. Do not add text overlays or violate the constraints.

Art direction:
- Aesthetic, visually striking illustration — not photorealistic and not a plain realistic photo background.
- Warm, rich palette: saffron, ochre, gold, ivory, crimson, deep teal, sunset amber. Favor harmonious warm tones that feel devotional and inviting.
- Style may blend Indian miniature painting, soft painterly illustration, or clean modern graphic art — polished, reel-worthy, and easy to read at a glance.
- If the idea is abstract or spiritual, express it symbolically with beauty and clarity rather than literal documentary realism.
- Never add any text overlay on top of image anywhere.
- Keep the like age, hairstyle, clothing consitent to what they are known to wear and portray in those contexts.

Scene and context:
- Root the scene in ancient Bharat and Hindu dharma when the shloka calls for it: appropriate deities, sages, nature, temples, rivers, forests, courts, or battlefields — only what the verse actually needs.
- Figures should wear period-appropriate ancient Indian dress; faces and setting should feel Indian, never Western or anachronistic.
- Compose with a clear focal subject, pleasing depth, and balanced framing suited to a vertical or square reel thumbnail.

Constraints:
- No text, letters, captions, watermarks, or borders in the image.
- No gore, explicit violence, or policy-violating content; soften or symbolize if needed.
- Return only the final image prompt as a single flowing paragraph (roughly 80–150 words), ready to paste into an image model.
`.trim();

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
  custom_instruction: z.string().optional()
});

type GetImagePromptInput = z.infer<typeof get_image_prompt_input_schema>;

/** Domain Effect — run only at a HTTP/tRPC boundary. */
export const get_image_prompt_func = (input: GetImagePromptInput) =>
  Effect.gen(function* () {
    const { project_key, selected_text_levels, index, model, custom_instruction } = input;

    const project = yield* get_project_by_key(project_key);
    if (!project) return { image_prompt: null as string | null, time_taken: 0 };

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
    if (!shloka) return { image_prompt: null as string | null, time_taken: 0 };

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
    return yield* Effect.promise(async () => {
      try {
        const time_start = Date.now();
        const result = await generateText({
          model: modelInstance,
          instructions: IMAGE_SYSTEM_PROMPT,
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
        return { image_prompt: result.output.image_prompt, time_taken: Date.now() - time_start };
      } catch (e) {
        console.error(e);
        return { image_prompt: null as string | null, time_taken: 0 };
      }
    });
  });

export const get_image_prompt_route = protectedAdminProcedure
  .input(get_image_prompt_input_schema)
  .query(({ input }) => runTrpcEffect(get_image_prompt_func(input)));
