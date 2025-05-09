import { task } from '@trigger.dev/sdk/v3';
import type OpenAI from 'openai';
import { z } from 'zod';
import {
  image_gen_route_schema,
  IMAGE_GENERATE_TRIGGER_ID,
  type image_output_type
} from '~/api/routes/ai/ai_types';
import { fetch_post } from '~/tools/fetch';

export const translate_sarga = task({
  id: IMAGE_GENERATE_TRIGGER_ID,
  maxDuration: 5 * 60, // 5 minutes
  run: async (payload: z.infer<typeof image_gen_route_schema.input>) => {
    payload = image_gen_route_schema.input.parse(payload);
    const { image_model, image_prompt, number_of_images } = payload;

    try {
      const time_start = Date.now();
      let response: (image_output_type | null)[] = null!;
      if (image_model === 'sd3-core')
        response = await make_image_sd3_core(image_prompt, number_of_images);
      else if (image_model === 'dall-e-3')
        response = await make_image_dall_e_3(image_prompt, number_of_images);
      else response = await make_image_gpt_1_image(image_prompt, number_of_images);
      // default `gpt-image-1`
      return {
        images: response,
        time_taken: Date.now() - time_start
      };
    } catch (e) {
      console.log(e);
      return { success: false };
    }
  }
});

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
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
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

const make_image_gpt_1_image = async (image_prompt: string, number_of_images: number) => {
  const get_single_image = async () => {
    try {
      const req = await fetch_post('https://api.openai.com/v1/images/generations', {
        json: {
          model: 'gpt-image-1',
          prompt: image_prompt,
          n: 1,
          size: '1024x1024',
          quality: 'medium'
        } as OpenAI.Images.ImageGenerateParams,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      });
      if (!req.ok) {
        console.error('Error:', await req.text());
        throw new Error('Failed to fetch image');
      }
      const raw_resp = (await req.json()) as OpenAI.Images.ImagesResponse;
      // when returned as plain URL
      const resp = z
        .object({
          created: z.number().int(),
          data: z
            .object({
              revised_prompt: z.string().optional(),
              b64_json: z.string()
            })
            .array()
        })
        .parse(raw_resp);

      return {
        created: resp.created,
        prompt: resp.data[0]?.revised_prompt ?? image_prompt,
        url: `data:image/png;base64,${resp.data[0].b64_json}`,
        out_format: 'b64_json',
        model: 'gpt-image-1',
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
            Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
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
