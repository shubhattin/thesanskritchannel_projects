import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Config } from '@sveltejs/adapter-vercel';
import { and, eq, inArray } from 'drizzle-orm';
import JSZip from 'jszip';
import { protected_admin_route_check } from '~/api/api_init';
import { db } from '~/db/db';
import { image_assets, text_image_assets_join } from '~/db/schema';
import { cache_db_options_app } from '~/utils/cache.server/cache_db_options.server';
import {
  buildAiImagesZipFileName,
  download_images_zip_input_schema,
  uniquifyZipFilenames
} from '~/utils/image_assets/download_images_zip';
import { get_project_by_id } from '~/utils/project/list.server';
import { requireProjectPath } from '~/utils/project/paths_db.server';
import { createS3Client, getAssetFile } from '~/utils/s3/upload_file.server';

export const config: Config = {
  split: true,
  maxDuration: 500
};

export const POST: RequestHandler = async ({ request }) => {
  const user = await protected_admin_route_check(request.headers);
  if (!user || user.role !== 'admin') throw error(401, 'UNAUTHORIZED');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const parsed = download_images_zip_input_schema.safeParse(body);
  if (!parsed.success) {
    throw error(400, parsed.error.issues[0]?.message ?? 'Invalid request body');
  }

  const { project_id, path_params, files, zip_file_name } = parsed.data;

  const image_ids = files.map((f) => f.image_id);
  if (new Set(image_ids).size !== image_ids.length) {
    throw error(400, 'Duplicate image_id values are not allowed');
  }

  const project = await get_project_by_id(project_id, cache_db_options_app);
  if (!project) throw error(404, 'Project not found');

  const expected_zip_name = buildAiImagesZipFileName(project.key, path_params);
  if (zip_file_name !== expected_zip_name) {
    throw error(400, 'zip_file_name does not match project key and path');
  }

  const path = path_params.join(':');
  let projectPath;
  try {
    projectPath = await requireProjectPath(db, project_id, path);
  } catch {
    throw error(404, `Project path not found: ${path || '(root)'}`);
  }

  const rows = await db
    .select({
      id: image_assets.id,
      s3_key: image_assets.s3_key
    })
    .from(text_image_assets_join)
    .innerJoin(image_assets, eq(text_image_assets_join.image_asset_id, image_assets.id))
    .where(
      and(
        eq(text_image_assets_join.project_path_id, projectPath.id),
        inArray(image_assets.id, image_ids)
      )
    );

  if (rows.length !== image_ids.length) {
    const found = new Set(rows.map((r) => r.id));
    const missing = image_ids.filter((id) => !found.has(id));
    throw error(404, `Image(s) not found on this path: ${missing.join(', ')}`);
  }

  const s3_by_id = new Map(rows.map((r) => [r.id, r.s3_key] as const));
  const zip_files = uniquifyZipFilenames(files);
  const s3Client = createS3Client();
  const zip = new JSZip();

  try {
    for (const file of zip_files) {
      const s3_key = s3_by_id.get(file.image_id);
      if (!s3_key) throw error(404, `Image not found: ${file.image_id}`);
      const buffer = await getAssetFile(s3_key, { s3Client });
      zip.file(file.filename, buffer, { compression: 'STORE' });
    }

    const zip_buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'STORE'
    });

    return new Response(new Uint8Array(zip_buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(zip_buffer.byteLength),
        'Content-Disposition': `attachment; filename="${expected_zip_name}"`,
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('download_images_zip failed', err);
    throw error(500, 'Failed to build images zip');
  }
};
