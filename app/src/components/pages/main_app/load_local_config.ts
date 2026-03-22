import { z } from 'zod';
import { env } from '$env/dynamic/public';

export async function loadLocalConfig() {
  const yaml = await import('js-yaml');

  const config_schema = z.object({
    image_tool_opened: z.boolean().optional(),
    view_translation_status: z.boolean().optional(),
    trans_lang: z.string().optional(),
    editing_status_on: z.boolean().optional(),
    ai_tool_opened: z.boolean().optional(),
    use_ai_sample_data: z.boolean().optional()
  });
  let config: z.infer<typeof config_schema> = {};
  if (env.PUBLIC_LOCAL_CONFIG === 'true') {
    try {
      const url = new URL('/src/components/pages/main_app/local_config.yaml', import.meta.url).href;
      const request = await fetch(url);
      const data = await request.text();
      config = config_schema.parse(yaml.load(data));
    } catch (e) {}
  }

  return config;
}
