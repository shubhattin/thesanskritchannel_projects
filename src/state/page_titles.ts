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
  '/parivartak': {
    title: 'Lipi Parivartak',
    classes: 'text-xl font-bold'
  },
  '/': {
    title: '',
    classes: 'text-xl font-bold'
  },
  '/ramayanam': {
    title: 'श्रीमद्रामायणम्',
    startsWith: true,
    classes: 'text-xl font-bold'
  },
  '/bhagavadgita': {
    title: 'श्रीमद्भगवद्गीता',
    startsWith: true,
    classes: 'text-xl font-bold'
  }
};
