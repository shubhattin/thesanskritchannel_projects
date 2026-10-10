export type LekhaListPost = {
  id: number;
  title: string;
  description: string | null;
  title_transliterated: string | null;
  description_transliterated: string | null;
  auto_transliterate_title: boolean;
  auto_transliterate_description: boolean;
  tags: string[];
  url_slug: string;
  published_at: Date | string | null;
};
