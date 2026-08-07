import { Effect } from 'effect';
import { z } from 'zod';
import { image_gen_route_schema } from './ai_types';
import { resolveSelectedTextProjectPath } from '~/utils/project/paths_db.server';
import { persistImageAsset } from '~/utils/image_assets/persist.server';
import { getCDNUrlSync } from '~/utils/cdn';
import { AiProvider } from '~/effect/ai';
import { dbRun } from '~/effect/database';
import { get_project_info_by_id } from '~/utils/project/list.server';

const IMAGE_SIZE = '1024x1024' as const;

type image_model_type = z.infer<typeof image_gen_route_schema.input>['image_model'];

const IMAGE_QUALITY: Record<image_model_type, 'low' | 'medium' | 'high'> = {
  'gpt-image-1': 'medium',
  'gpt-image-2': 'medium'
};

/** Domain Effect — run only at a tRPC/HTTP boundary. */
export const gen_image_func = (payload: z.infer<typeof image_gen_route_schema.input>) => {
  const parsed = image_gen_route_schema.input.parse(payload);
  const { image_model, image_prompt, number_of_images, project_id, selected_text_levels, index } =
    parsed;

  return Effect.gen(function* () {
    const { levels } = yield* get_project_info_by_id(project_id);
    const { projectPath, path_params } = yield* dbRun('image_gen.resolve_path', (db) =>
      resolveSelectedTextProjectPath(db, project_id, selected_text_levels, levels)
    );

    const ai = yield* AiProvider;
    const time_start = Date.now();
    const created = Date.now();

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

    for (let i = 0; i < number_of_images; i++) {
      const base64 = yield* ai.generateImageBase64({
        prompt: image_prompt,
        modelId: image_model,
        size: IMAGE_SIZE,
        quality: IMAGE_QUALITY[image_model]
      });
      const asset = yield* persistImageAsset({
        project_id,
        project_path_id: projectPath.id,
        path_params,
        index,
        image: base64,
        description: image_prompt.slice(0, 150),
        create_join: true
      });
      images.push({
        id: asset.id,
        s3_key: asset.s3_key,
        url: getCDNUrlSync(asset.s3_key),
        width: asset.width,
        height: asset.height,
        description: asset.description,
        prompt: image_prompt,
        created,
        model: image_model,
        file_format: 'webp'
      });
    }

    return {
      images,
      time_taken: Date.now() - time_start,
      success: true as const
    };
  }).pipe(
    Effect.catch((cause) => {
      console.error(cause);
      return Effect.succeed({ success: false as const });
    })
  );
};
