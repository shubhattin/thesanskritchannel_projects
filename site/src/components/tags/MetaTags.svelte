<script lang="ts">
  import { page } from '$app/state';

  interface Props {
    title: string;
    description?: string | null;
    keywords?: string[];
    share_image_info?: {
      url: string;
      width: number;
      height: number;
    };
  }

  let { title, description = null, keywords = [], share_image_info }: Props = $props();

  /** Same default share image as `app/src/components/tags/MetaTags.svelte`. */
  const DEFAULT_SHARE_IMAGE_INFO = {
    url: 'https://cdn.jsdelivr.net/gh/shubhattin/thesanskritchannel_projects@latest/others/project_images/share_image.jpg',
    width: 512,
    height: 215
    // ^ preferred size: 1200x630
  };

  const image = $derived(share_image_info ?? DEFAULT_SHARE_IMAGE_INFO);
  const canonical_url = $derived(`${page.url.origin}${page.url.pathname}`);
  const keywords_content = $derived(
    keywords.map((keyword) => keyword.trim()).filter((keyword) => keyword.length > 0)
  );
</script>

<svelte:head>
  <title>{title}</title>
  <link rel="canonical" href={canonical_url} />
  <meta property="og:title" content={title} />
  <meta property="og:site_name" content="The Sanskrit Channel" />
  <meta property="og:url" content={canonical_url} />
  <meta property="og:type" content="website" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:card" content="summary_large_image" />

  {#if description}
    <meta name="description" content={description} />
    <meta property="og:description" content={description} />
    <meta name="twitter:description" content={description} />
  {/if}

  {#if keywords_content.length > 0}
    <meta name="keywords" content={keywords_content.join(', ')} />
  {/if}

  <meta property="og:image" content={image.url} />
  <meta property="og:image:width" content={image.width.toString()} />
  <meta property="og:image:height" content={image.height.toString()} />
  <meta name="twitter:image" content={image.url} />
</svelte:head>
