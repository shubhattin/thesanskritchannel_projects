import { generateImage } from 'ai';
import type { OpenAIImageModelGenerationOptions } from '@ai-sdk/openai';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { image_gen_route_schema } from './ai_types';
import { openai } from './providers';
import { resolveSelectedTextProjectPath } from '~/utils/project/paths_db.server';
import { db } from '~/db/db';
import { persistImageAsset } from '~/utils/image_assets/persist.server';
import { getCDNUrl } from '~/utils/cdn';

const IMAGE_SIZE = '1024x1024' as const;

type image_model_type = z.infer<typeof image_gen_route_schema.input>['image_model'];

const IMAGE_MODEL_OPTIONS: Record<image_model_type, OpenAIImageModelGenerationOptions> = {
  'gpt-image-1': { quality: 'medium' },
  'gpt-image-2': { quality: 'medium' }
};

export const gen_image_func = async (payload: z.infer<typeof image_gen_route_schema.input>) => {
  payload = image_gen_route_schema.input.parse(payload);
  const { image_model, image_prompt, number_of_images, project_id, selected_text_levels, index } =
    payload;

  try {
    const { projectPath, path_params } = await resolveSelectedTextProjectPath(
      db,
      project_id,
      selected_text_levels
    );

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

    const created = Math.trunc(result.responses[0]?.timestamp.getTime() ?? Date.now());
    const openai_metadata = result.providerMetadata?.openai as
      | { images?: { revisedPrompt?: string }[] }
      | undefined;

    const images: {
      id: number;
      s3_key: string;
      url: string;
      width: number;
      height: number;
      description: string | null;
      prompt: string;
      created: number;
      model: image_model_type;
      file_format: 'webp';
    }[] = [];
    try {
      for (let i = 0; i < result.images.length; i++) {
        const image = result.images[i]!;
        const revised = openai_metadata?.images?.[i]?.revisedPrompt;
        const description = (revised ?? image_prompt).slice(0, 150);
        const asset = await persistImageAsset({
          project_id,
          project_path_id: projectPath.id,
          path_params,
          index,
          image: image.base64,
          description,
          create_join: true
        });
        images.push({
          id: asset.id,
          s3_key: asset.s3_key,
          url: getCDNUrl(asset.s3_key),
          width: asset.width,
          height: asset.height,
          description: asset.description,
          prompt: revised ?? image_prompt,
          created,
          model: image_model,
          file_format: 'webp' as const
        });
      }
    } catch (persist_err) {
      if (persist_err instanceof TRPCError) throw persist_err;
      console.error(persist_err);
      return {
        success: false as const,
        images: images.length > 0 ? images : undefined,
        time_taken: Date.now() - time_start
      };
    }

    return {
      images,
      time_taken: Date.now() - time_start,
      success: true as const
    };
  } catch (e) {
    if (e instanceof TRPCError) throw e;
    console.error(e);
    return { success: false as const };
  }
};
