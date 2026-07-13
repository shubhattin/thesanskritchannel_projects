import { is_empty_shloka_leaf } from '~/components/pages/map_edit/map_edit_lib';
import type { recursive_list_type } from '~/state/data_types';

export type ProjectDeleteResourceCountsInput = {
  map: recursive_list_type | null | undefined;
  texts: number;
  translations: number;
  media_attachment: number;
  project_paths: number;
  user_project_join: number;
  user_project_language_join: number;
};

export type ProjectDeleteResourceCounts = {
  texts: number;
  translations: number;
  media_attachment: number;
  project_paths: number;
  user_project_join: number;
  user_project_language_join: number;
  auto_clear_project_paths: boolean;
  total: number;
};

/**
 * Empty childless shloka roots always keep a root `project_paths` row
 * (`ON DELETE RESTRICT` on projects). That alone should not block deletion.
 */
export const can_auto_clear_root_project_paths = (
  map: recursive_list_type | null | undefined,
  texts_count: number,
  translations_count: number,
  media_count: number
) =>
  Boolean(
    map &&
    is_empty_shloka_leaf(map) &&
    texts_count === 0 &&
    translations_count === 0 &&
    media_count === 0
  );

/** Apply empty-shloka-root exception to raw connected-data counts. */
export const finalize_project_delete_resource_counts = (
  input: ProjectDeleteResourceCountsInput
): ProjectDeleteResourceCounts => {
  const auto_clear_project_paths = can_auto_clear_root_project_paths(
    input.map,
    input.texts,
    input.translations,
    input.media_attachment
  );
  const project_paths = auto_clear_project_paths ? 0 : input.project_paths;

  return {
    texts: input.texts,
    translations: input.translations,
    media_attachment: input.media_attachment,
    project_paths,
    user_project_join: input.user_project_join,
    user_project_language_join: input.user_project_language_join,
    auto_clear_project_paths,
    total:
      input.texts +
      input.translations +
      input.media_attachment +
      project_paths +
      input.user_project_join +
      input.user_project_language_join
  };
};
