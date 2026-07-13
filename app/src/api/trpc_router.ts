import { t } from './trpc_init';
import { user_router } from './routes/user';
import { project_router } from './routes/project/project';
import { translation_router } from './routes/translation';
import { ai_router } from './routes/ai';
import { media_router } from './routes/media';
import { cache_router } from './routes/cache';
import { grammar_router } from './routes/grammar/grammar';
import { text_router } from './routes/text';
import { lekha_router } from './routes/site/lekha';
import { image_tool_router } from './routes/image_tool';
import { batch_ai_router } from './routes/batch_ai';

export const router = t.router({
  user: user_router,
  project: project_router,
  translation: translation_router,
  ai: ai_router,
  batch_ai: batch_ai_router,
  media: media_router,
  cache: cache_router,
  grammar: grammar_router,
  text: text_router,
  image_tool: image_tool_router,
  site: t.router({
    lekha: lekha_router
  })
});

export type Router = typeof router;
