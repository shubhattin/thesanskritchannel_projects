import { t } from './trpc_init';
import { user_router } from './routes/user';
import { project_router } from './routes/project';
import { translation_router } from './routes/translation';
import { ai_router } from './routes/ai';
import { media_router } from './routes/media';

export const router = t.router({
  user: user_router,
  project: project_router,
  translation: translation_router,
  ai: ai_router,
  media: media_router
});

export type Router = typeof router;
