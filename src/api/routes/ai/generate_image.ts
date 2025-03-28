import { protectedAdminProcedure } from '~/api/trpc_init';
import { env } from '$env/dynamic/private';
import { z } from 'zod';
import { fetch_post } from '~/tools/fetch';
import type OpenAI from 'openai';

const available_models_schema = z.enum(['dall-e-3', 'sd3-core']);

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
  create_image_output_schema('sd3-core', 'b64_json', 'png').extend({
    seed: z.number().int(),
    finish_reason: z.string()
  })
]);

type image_output_type = z.infer<typeof image_schema>;

const _make_image_dall_e = async (
  image_prompt: string,
  number_of_images: number,
  dall_e_version: 2 | 3
) => {
  const get_single_image = async () => {
    try {
      // getting some unexpected errors while using the `openai` npm module so using HTTP API instead
      const req = await fetch_post('https://api.openai.com/v1/images/generations', {
        json: {
          model: `dall-e-${dall_e_version}`,
          prompt: image_prompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          response_format: 'url'
        } as OpenAI.Images.ImageGenerateParams,
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`
        }
      });
      if (!req.ok) throw new Error('Failed to fetch image');
      const raw_resp = (await req.json()) as OpenAI.Images.ImagesResponse;
      // when returned as plain URL
      const resp = z
        .object({
          created: z.number().int(),
          data: z
            .object({
              revised_prompt: z.string().optional(),
              url: z.string()
            })
            .array()
        })
        .parse(raw_resp);

      return {
        created: resp.created,
        prompt: resp.data[0]?.revised_prompt ?? image_prompt,
        url: resp.data[0].url,
        out_format: 'url',
        model: 'dall-e-3',
        file_format: 'png'
      } satisfies image_output_type;
    } catch (e) {
      console.error(e);
      return null;
    }
  };
  const responses = Array.from({ length: number_of_images }, () => get_single_image());
  return await Promise.all(responses);
};
const make_image_dall_e_3 = (image_prompt: string, number_of_images: number) =>
  _make_image_dall_e(image_prompt, number_of_images, 3);

const make_image_sd3_core = async (image_prompt: string, number_of_images: number) => {
  const get_single_image = async () => {
    try {
      const response = await fetch_post(
        'https://api.stability.ai/v2beta/stable-image/generate/core',
        {
          form: {
            prompt: image_prompt,
            output_format: 'png'
          },
          headers: {
            Authorization: `Bearer ${env.STABILITY_API_KEY}`,
            Accept: 'application/json; type=image/png'
          }
        }
      );
      if (!response.ok) {
        throw new Error(`Non-200 response: ${await response.text()}`);
      }
      type GenerationResponse = {
        image: string;
        finish_reason: string;
        seed: number;
      };
      const responseJSON = (await response.json()) as GenerationResponse;
      return {
        url: `data:image/png;base64,${responseJSON.image}`,
        created: new Date().getTime(),
        prompt: image_prompt,
        file_format: 'png',
        model: 'sd3-core',
        out_format: 'b64_json',
        finish_reason: responseJSON.finish_reason,
        seed: responseJSON.seed
      } satisfies image_output_type;
    } catch (e) {
      // console.error(e);
      return null;
    }
  };
  const responses = Array.from({ length: number_of_images }, () => get_single_image());
  return await Promise.all(responses);
};

export const get_generated_images_route = protectedAdminProcedure
  .input(
    z.object({
      image_prompt: z.string(),
      number_of_images: z.number().int().min(1).max(4),
      image_model: available_models_schema
    })
  )
  .query(async ({ input: { image_prompt, number_of_images, image_model } }) => {
    const time_start = Date.now();
    let response: (image_output_type | null)[] = null!;
    if (image_model === 'sd3-core')
      response = await make_image_sd3_core(image_prompt, number_of_images);
    else response = await make_image_dall_e_3(image_prompt, number_of_images);
    // default` dall-e-3`
    return {
      images: response,
      time_taken: Date.now() - time_start
    };
  });

// const make_image_sdxl = async (image_prompt: string, number_of_images: number) => {
//   try {
//     const engineId = 'stable-diffusion-v1-6';
//     const apiHost = 'https://api.stability.ai';
//     const apiKey = env.STABILITY_API_KEY;
//     const response = await fetch_post(`${apiHost}/v1/generation/${engineId}/text-to-image`, {
//       headers: {
//         Accept: 'application/json',
//         Authorization: `Bearer ${apiKey}`
//       },
//       json: {
//         text_prompts: [
//           {
//             text: image_prompt
//           }
//         ],
//         cfg_scale: 7,
//         height: 768,
//         width: 768,
//         steps: 30,
//         samples: number_of_images
//       }
//     });
//     if (!response.ok) {
//       throw new Error(`Non-200 response: ${await response.text()}`);
//     }
//     type GenerationResponse = {
//       artifacts: Array<{
//         base64: string;
//         seed: number;
//         finishReason: string;
//       }>;
//     };
//     const responseJSON = (await response.json()) as GenerationResponse;
//     return responseJSON.artifacts.map((artifact) => ({
//       url: `data:image/png;base64,${artifact.base64}`,
//       created: new Date().getTime(),
//       prompt: image_prompt,
//       file_format: 'png',
//       model: 'sdxl',
//       out_format: 'b64_json',
//       finish_reason: artifact.finishReason,
//       seed: artifact.seed
//     })) satisfies image_output_type[];
//   } catch (e) {
//     return [null];
//   }
// };
