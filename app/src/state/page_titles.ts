import { PROJECT_LIST } from './project_list';

export const PAGE_TITLES: Record<
  string,
  {
    title: string;
    startsWith?: boolean;
    classes: string;
  }
> = {
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

PROJECT_LIST.forEach((project) => {
  PAGE_TITLES[`/${project.key}`] = {
    title: project.name_dev,
    startsWith: true,
    classes: 'text-xl font-bold'
  };
});
