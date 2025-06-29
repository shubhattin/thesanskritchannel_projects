<script lang="ts">
  interface Props {
    title: string;
    description?: string | null;
    share_image_info?: {
      url: string;
      width: number;
      height: number;
    };
  }

  let { title, description = null, share_image_info }: Props = $props();

  const DEFAULT_SHARE_IMAGE_INFO = {
    url: 'https://cdn.jsdelivr.net/gh/shubhattin/thesanskritchannel_projects@latest/others/project_images/share_image.jpg',
    width: 512,
    height: 215
  };
</script>

<svelte:head>
  <title>{title}</title>
  <meta property="og:title" content={title} />
  <meta property="og:site_name" content={title} />
  <meta name="twitter:title" content={title} />

  <!-- Description -->
  {#if description}
    <meta name="description" content={description} />
    <meta property="og:description" content={description} />
    <meta name="twitter:description" content={description} />
  {/if}

  <!-- Image -->
  <meta
    property="og:image:width"
    content={share_image_info?.width.toString() || DEFAULT_SHARE_IMAGE_INFO.width.toString()}
  />
  <meta
    property="og:image:height"
    content={share_image_info?.height.toString() || DEFAULT_SHARE_IMAGE_INFO.height.toString()}
  />
  <meta name="twitter:image" content={share_image_info?.url || DEFAULT_SHARE_IMAGE_INFO.url} />
  <meta property="og:image" content={share_image_info?.url || DEFAULT_SHARE_IMAGE_INFO.url} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
