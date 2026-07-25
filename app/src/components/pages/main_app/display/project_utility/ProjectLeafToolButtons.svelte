<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '~/tools/Icon.svelte';
  import { BiImage } from 'svelte-icons-pack/bi';
  import { RiUserFacesRobot2Line } from 'svelte-icons-pack/ri';
  import { Button } from '$lib/components/ui/button';
  import { useSession } from '~/lib/auth-client';
  import { ai_tool_opened, editing_mode, image_tool_opened } from '~/state/main_app/state.svelte';
  import { fly, scale } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';

  const session = useSession();
  const is_admin = $derived($session.data?.user.role === 'admin');
  const tools_disabled = $derived($editing_mode !== 'none');

  /** Gate so Svelte intro transitions run after client mount (not skipped on hydrate). */
  let show_buttons = $state(false);
  onMount(() => {
    show_buttons = true;
  });
</script>

{#if show_buttons}
  <div class="ms-2 flex flex-wrap items-center gap-2 sm:ms-3">
    <div in:fly={{ y: -10, duration: 380, easing: cubicOut }} class="inline-flex">
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="group h-8 gap-1.5 px-2.5 font-semibold"
        disabled={tools_disabled}
        title="Image Tool"
        onclick={() => {
          if (tools_disabled) return;
          image_tool_opened.set(true);
        }}
      >
        <span
          class="inline-flex origin-center transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
          in:scale={{ duration: 480, start: 0.2, opacity: 0, easing: backOut, delay: 60 }}
        >
          <Icon src={BiImage} class="size-5 shrink-0 fill-sky-500 dark:fill-sky-400" />
        </span>
        <span class="hidden sm:inline">Image Tool</span>
      </Button>
    </div>
    {#if is_admin}
      <div in:fly={{ y: -10, duration: 380, easing: cubicOut, delay: 90 }} class="inline-flex">
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="group h-8 gap-1.5 px-2.5 font-semibold"
          disabled={tools_disabled}
          title="AI Image Generator"
          onclick={() => {
            if (tools_disabled) return;
            $ai_tool_opened = true;
          }}
        >
          <span
            class="inline-flex origin-center transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
            in:scale={{ duration: 480, start: 0.2, opacity: 0, easing: backOut, delay: 140 }}
          >
            <Icon
              src={RiUserFacesRobot2Line}
              class="size-5 shrink-0 fill-blue-500 dark:fill-blue-400"
            />
          </span>
          <span class="hidden sm:inline">AI Image Generator</span>
        </Button>
      </div>
    {/if}
  </div>
{/if}
