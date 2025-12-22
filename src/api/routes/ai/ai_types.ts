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
const AI_TEXT_MODELS = ['gpt-4.1', 'o3-mini', 'gpt-5.1', 'gpt-5.2'] as const;
export type ai_text_models_type = (typeof AI_TEXT_MODELS)[number];

export const text_models_enum = z.enum(AI_TEXT_MODELS);

export const translate_route_schema = {
  input: z.object({
    project_id: z.number().int(),
    lang_id: z.number().int(),
    model: text_models_enum,
    messages: z
      .object({
        role: z.union([z.literal('user'), z.literal('assistant')]),
        content: z.string()
      })
      .array()
  }),
  output: z.union([
    z.object({ success: z.literal(true), translations: translation_out_schema.array() }),
    z.object({ success: z.literal(false) })
  ])
};

export const available_models_schema = z.enum(['dall-e-3', 'gpt-image-1', 'sd3-core']);

const create_image_output_schema = <
  Model extends z.infer<typeof available_models_schema>,
  ImageFormat extends 'url' | 'b64_json',
  FileFormat extends 'png' | 'jpeg' | 'webp'
>(
  model: Model,
  imageFormat: ImageFormat,
  fileFormat: FileFormat
) =>
  z.object({
    created: z.number().int(),
    prompt: z.string(),
    url: z.string(),
    model: z.literal(model),
    out_format: z.literal(imageFormat),
    file_format: z.literal(fileFormat)
  });

const image_schema = z.union([
  create_image_output_schema('dall-e-3', 'url', 'png'),
  create_image_output_schema('gpt-image-1', 'b64_json', 'png'),
  create_image_output_schema('sd3-core', 'b64_json', 'png').extend({
    seed: z.number().int(),
    finish_reason: z.string()
  })
]);

export const image_gen_route_schema = {
  input: z.object({
    image_prompt: z.string(),
    number_of_images: z.number().int().min(1).max(4),
    image_model: available_models_schema
  }),
  output: z.object({
    images: image_schema.array(),
    time_taken: z.number().int(),
    success: z.literal(true)
  })
};
export type image_output_type = z.infer<typeof image_schema>;
