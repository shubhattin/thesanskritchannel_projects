import { generateImage } from 'ai';
import type { OpenAIImageModelGenerationOptions } from '@ai-sdk/openai';
import { z } from 'zod';
import { image_gen_route_schema, type image_output_type } from './ai_types';
import { openai } from './providers';

const IMAGE_SIZE = '1024x1024' as const;

type image_model_type = z.infer<typeof image_gen_route_schema.input>['image_model'];

const IMAGE_MODEL_OPTIONS: Record<image_model_type, OpenAIImageModelGenerationOptions> = {
  'gpt-image-1': { quality: 'medium' },
  'gpt-image-2': { quality: 'medium' }
};

const to_image_output = (
  image_model: image_model_type,
  image_prompt: string,
  image_b64: string,
  media_type: string,
  revised_prompt: string | undefined,
  created: number
): image_output_type => ({
  created,
  prompt: revised_prompt ?? image_prompt,
  url: `data:${media_type};base64,${image_b64}`,
  out_format: 'b64_json',
  model: image_model,
  file_format: 'png'
});

export const gen_image_func = async (payload: z.infer<typeof image_gen_route_schema.input>) => {
  payload = image_gen_route_schema.input.parse(payload);
  const { image_model, image_prompt, number_of_images } = payload;

  try {
    const time_start = Date.now();
    const result = await generateImage({
      model: openai.image(image_model),
      prompt: image_prompt,
      n: number_of_images,
      size: IMAGE_SIZE,
      providerOptions: {
        openai: IMAGE_MODEL_OPTIONS[image_model] satisfies OpenAIImageModelGenerationOptions
      }
    });

    const created = Math.trunc(result.responses[0]?.timestamp.getTime() ?? Date.now() / 1000);
    const openai_metadata = result.providerMetadata.openai as
      | { images?: { revisedPrompt?: string }[] }
      | undefined;

    const images = result.images.map((image, index) =>
      to_image_output(
        image_model,
        image_prompt,
        image.base64,
        image.mediaType || 'image/png',
        openai_metadata?.images?.[index]?.revisedPrompt,
        created
      )
    );

    return {
      images,
      time_taken: Date.now() - time_start,
      success: true as const
    };
  } catch (e) {
    console.error(e);
    return { success: false as const };
  }
};
