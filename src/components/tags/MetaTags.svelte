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
</script>

<svelte:head>
  <title>{title}</title>
  <meta property="og:title" content={title} />
  <meta property="og:site_name" content={title} />
  <meta name="twitter:title" content={title} />

  {#if description}
    <meta name="description" content={description} />
    <meta property="og:description" content={description} />
    <meta name="twitter:description" content={description} />
  {/if}

  <!-- Image -->
  <meta
    property="og:image"
    content={share_image_info?.url ||
      'https://cdn.jsdelivr.net/gh/shubhattin/thesanskritchannel_projects@latest/others/project_images/share_image.jpg'}
  />
  <meta property="og:image:width" content={share_image_info?.width.toString() || '512'} />
  <meta property="og:image:height" content={share_image_info?.height.toString() || '215'} />
  <meta
    name="twitter:image"
    content={share_image_info?.url ||
      'https://cdn.jsdelivr.net/gh/shubhattin/thesanskritchannel_projects@latest/others/project_images/share_image.jpg'}
  />
</svelte:head>
