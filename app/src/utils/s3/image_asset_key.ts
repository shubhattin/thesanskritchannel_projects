import { randomUUID } from 'node:crypto';
import { PROJECT_S3_ALIAS, SUB_FOLDERS } from '~/constants';

export type ImageAssetS3Key =
  `${typeof PROJECT_S3_ALIAS}/${(typeof SUB_FOLDERS)[number]}/image_assets/${string}.webp`;

/** Flat key — no project/path/index subfolders. */
export const buildImageAssetS3Key = (
  project_id: number,
  path_params: readonly number[],
  index: number | null,
  uuid: string = randomUUID()
): ImageAssetS3Key => {
  const path_part = path_params.join('-');
  const index_part = index === null ? 'orphan' : String(index);
  const file_name = `${project_id}:${path_part}:${index_part}:${uuid}`;
  return `${PROJECT_S3_ALIAS}/${SUB_FOLDERS[0]}/image_assets/${file_name}.webp`;
};

/** Allows digits, letters, `_`, `.`, `-`, and `:` in the flat filename. */
const ASSET_KEY_PATTERN = new RegExp(
  `^${PROJECT_S3_ALIAS}/(?:${SUB_FOLDERS.join('|')})/image_assets/[\\w.:-]+\\.webp$`
);

export const isValidImageAssetS3Key = (key: string): key is ImageAssetS3Key =>
  ASSET_KEY_PATTERN.test(key);
