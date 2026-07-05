import { protectedAdminProcedure } from '~/api/trpc_init';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { text_models_enum, type ai_text_models_type } from './ai_types';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { format_string_text } from '~/tools/kry';
import { CACHE } from '~/utils/cache.server/cached_loader.server';
import { cache_db_options_app } from '~/utils/cache.server/cache_db_options.server';
import { get_project_by_key, get_project_info_by_id } from '~/utils/project/list.server';
import { get_path_params } from '~/state/project_list';
import { lang_list_obj } from '~/state/lang_list';

const openrouter_text_model = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });

const IMAGE_SYSTEM_PROMPT = `
You write image-generation prompts for Sanskrit scripture content meant to look beautiful. It will be used in multiple places like as a backgound image to shlokas on and so on.

You will receive a Sanskrit shloka and, when available, its English translation. Produce one detailed English image prompt that captures the essence of the meaning.

Art direction:
- Aesthetic, visually striking illustration — not photorealistic and not a plain realistic photo background.
- Warm, rich palette: saffron, ochre, gold, ivory, crimson, deep teal, sunset amber. Favor harmonious warm tones that feel devotional and inviting.
- Style may blend Indian miniature painting, soft painterly illustration, or clean modern graphic art — polished, reel-worthy, and easy to read at a glance.
- If the idea is abstract or spiritual, express it symbolically with beauty and clarity rather than literal documentary realism.

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

const MODELS = {
  'gpt-5.2': openrouter_text_model('openai/gpt-5.2')
} satisfies Record<ai_text_models_type, any>;

const model_custom_options = {
  'gpt-5.2': {
    providerOptions: {
      openrouter: {
        reasoningEffort: 'low'
      }
    }
  }
} satisfies {
  [key in ai_text_models_type]?: object;
};

export const get_image_prompt_input_schema = z.object({
  project_key: z.string(),
  selected_text_levels: z.array(z.int().nullable()),
  index: z.int().min(0),
  model: text_models_enum
});

type GetImagePromptInput = z.infer<typeof get_image_prompt_input_schema>;

export const get_image_prompt_func = async (input: GetImagePromptInput) => {
  const { project_key, selected_text_levels, index, model } = input;

  const project = await get_project_by_key(project_key, cache_db_options_app);
  if (!project) return { image_prompt: null, time_taken: 0 };

  const project_info = await get_project_info_by_id(project.id, cache_db_options_app);
  const path_params = get_path_params(selected_text_levels, project_info.levels);
  const text_data = await CACHE.text_data.get(
    { key: project_key, path_params },
    cache_db_options_app
  );
  const shloka = text_data[index];
  if (!shloka) return { image_prompt: null, time_taken: 0 };

  let shloka_text = shloka.text;
  const translations = await CACHE.translation.get(
    {
      project_id: project.id,
      lang_id: lang_list_obj.English,
      selected_text_levels
    },
    cache_db_options_app
  );
  const english_translation = translations.get(index);
  if (english_translation) shloka_text += '\n\n' + english_translation;

  const list_level_names = project_info.level_names.slice(1);
  const text_info = path_params.map((param, i) => `${list_level_names[i]} ${param}`).join(', ');

  const prompt = format_string_text(IMAGE_USER_PROMPT, {
    text_name: project.name,
    text_info,
    shloka_text
  });

  try {
    const time_start = Date.now();
    const result = await generateText({
      model: MODELS[model],
      system: IMAGE_SYSTEM_PROMPT,
      ...(model_custom_options[model] ?? {}),
      prompt,
      output: Output.object({
        schema: z.object({
          image_prompt: z
            .string()
            .describe(
              'A single detailed English image prompt for an aesthetic illustration.'
            )
        })
      })
    });
    return { ...result.output, time_taken: Date.now() - time_start };
  } catch (e) {
    console.error(e);
    return { image_prompt: null, time_taken: 0 };
  }
};

export const get_image_prompt_route = protectedAdminProcedure
  .input(get_image_prompt_input_schema)
  .query(async ({ input }) => get_image_prompt_func(input));
