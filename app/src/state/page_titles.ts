import type { project_type } from './project_list';

export type page_title_info_type = {
  title: string;
  startsWith?: boolean;
  classes: string;
};

export const STATIC_PAGE_TITLES: Record<string, page_title_info_type> = {
  '/login': {
    title: 'Login',
    classes: 'text-xl font-bold'
  },
  '/user': {
    title: 'User Profile',
    classes: 'text-lg font-semibold mt-1'
  },
  '/search': {
    title: 'Search',
    classes: 'text-xl font-bold'
  },
  '/': {
    title: '',
    classes: 'text-xl font-bold'
  },
  '/grammar': {
    title: 'वैयाकरनम्',
    classes: 'text-xl font-bold'
  }
};

/** @deprecated use `get_page_title_info` with an explicit project list */
export const PAGE_TITLES = STATIC_PAGE_TITLES;

export const get_page_title_info = (
  pathname: string,
  project_list: readonly project_type[] = []
): page_title_info_type | undefined => {
  for (const key in STATIC_PAGE_TITLES) {
    const entry = STATIC_PAGE_TITLES[key]!;
    if (key === pathname && !entry.startsWith) return entry;
    if (pathname.startsWith(key) && entry.startsWith) return entry;
  }

  for (const project of project_list) {
    const key = `/${project.key}`;
    if (pathname === key || pathname.startsWith(`${key}/`)) {
      return {
        title: project.name_dev,
        startsWith: true,
        classes: 'text-xl font-bold'
      };
    }
  }

  return undefined;
};
