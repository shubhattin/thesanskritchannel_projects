import { z } from 'zod';

export const TRANSLATE_TRIGGER_ID = 'ai_text_translate';
export const IMAGE_GENERATE_TRIGGER_ID = 'ai_image_generate';

export const translation_out_schema = z
  .object({
    text: z.string().describe('The translation text'),
    index: z.number().describe('The index of shlokas to be generated, starting from 0.')
  })
  .describe(
    'This object will contain the translated text and the index of the shloka to be generated.'
  );
const AI_TEXT_MODELS = ['gpt-5.2', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol'] as const;
export type ai_text_models_type = (typeof AI_TEXT_MODELS)[number];

export const text_models_enum = z.enum(AI_TEXT_MODELS);

/** Default balanced model for translation work (client-safe). */
export const DEFAULT_TEXT_AI_MODEL: ai_text_models_type = 'gpt-5.6-terra';

export const translate_route_schema = {
  input: z.object({
    project_id: z.int(),
    lang_id: z.int(),
    model: text_models_enum,
    text_name: z.string(),
    text_data: z.array(
      z.object({
        index: z.int().min(0),
        text: z.string(),
        english_translation: z.string().optional()
      })
    )
  }),
  output: z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      translations: translation_out_schema.array()
    }),
    z.object({ success: z.literal(false), error: z.string().optional() })
  ])
};

export type translate_route_input = z.infer<typeof translate_route_schema.input>;
export type translate_route_output = z.infer<typeof translate_route_schema.output>;

export const available_image_models_schema = z.enum(['gpt-image-1', 'gpt-image-2']);

const persisted_image_schema = z.object({
  id: z.int(),
  s3_key: z.string(),
  url: z.string(),
  width: z.int(),
  height: z.int(),
  description: z.string().nullable(),
  prompt: z.string(),
  created: z.int(),
  model: available_image_models_schema,
  file_format: z.literal('webp')
});

export const image_gen_route_schema = {
  input: z.object({
    image_prompt: z.string().min(1),
    number_of_images: z.int().min(1).max(4),
    image_model: available_image_models_schema,
    project_id: z.int(),
    selected_text_levels: z.array(z.int().nullable()),
    index: z.int().min(0)
  }),
  output: z.discriminatedUnion('success', [
    z.object({
      images: persisted_image_schema.array(),
      time_taken: z.int(),
      success: z.literal(true)
    }),
    z.object({
      success: z.literal(false),
      /** Present when some images persisted before a later failure */
      images: persisted_image_schema.array().optional(),
      time_taken: z.int().optional()
    })
  ])
};
export type image_output_type = z.infer<typeof persisted_image_schema>;

/** For frontend info */
export const TEXT_MODEL_LIST_INFO = {
  'gpt-5.2': ['gpt 5.2', '400K token context window\n$1.75/1M Input tokens & $14/1M Output tokens'],
  'gpt-5.6-luna': [
    'gpt 5.6-luna',
    '1M token context window\n$1.00/1M Input tokens & $6/1M Output tokens'
  ],
  'gpt-5.6-terra': [
    'gpt 5.6-terra',
    '1M token context window\n$2.50/1M Input tokens & $15/1M Output tokens'
  ],
  'gpt-5.6-sol': [
    'gpt 5.6-sol',
    '1M token context window\n$5.00/1M Input tokens & $30/1M Output tokens'
  ]
} satisfies Record<ai_text_models_type, [string, string]>;
