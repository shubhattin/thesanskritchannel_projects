import { z } from 'zod';

export const SEARCH_MODE_ENUM = z.enum(['text', 'name']);
export type SearchMode = z.infer<typeof SEARCH_MODE_ENUM>;
