/**
 * Project registry — Effect domain lives in `~/effect/project_registry`.
 * Call sites should `yield*` these Effects (or run via app/site runtime runners).
 */
export {
  clearProjectRegistryCache,
  clearServerProjectInfoCache,
  clearServerProjectMapCache,
  clear_project_registry_cache,
  clear_server_project_info_cache,
  clear_server_project_map_cache,
  getProjectById,
  getProjectByKey,
  getProjectInfoById,
  getProjectInfoByKey,
  getProjectList,
  getProjectMapById,
  getProjectMapByKey,
  getProjectRegistry,
  projectListCache,
  projectMapCache,
  resolveProjectByKey,
  type ProjectLookupOptions,
  type ResolvedProjectByKey
} from '~/effect/project_registry';

/** Snake_case aliases matching the previous promise API names (now Effects). */
export {
  getProjectById as get_project_by_id,
  getProjectByKey as get_project_by_key,
  getProjectInfoById as get_project_info_by_id,
  getProjectInfoByKey as get_project_info_by_key,
  getProjectList as get_project_list,
  getProjectMapById as get_project_map_by_id,
  getProjectMapByKey as get_project_map_by_key,
  getProjectRegistry as get_project_registry,
  resolveProjectByKey as resolve_project_by_key,
  type ResolvedProjectByKey as resolved_project_by_key
} from '~/effect/project_registry';
