<script lang="ts">
  import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import Layers from '@lucide/svelte/icons/layers';
  import Plus from '@lucide/svelte/icons/plus';
  import Save from '@lucide/svelte/icons/save';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { toast } from 'svelte-sonner';
  import { useTRPC } from '~/api/client';
  import { useSession } from '~/lib/auth-client';
  import { copy_plain_object } from '~/tools/kry';
  import {
    BUILTIN_IMAGE_TOOL_PRESET_ID,
    BUILTIN_IMAGE_TOOL_PRESET_NAME,
    type ImageToolPresetConfig
  } from './image_tool_preset_schema';
  import {
    apply_image_tool_preset,
    collect_image_tool_preset,
    get_builtin_default_image_tool_preset,
    image_tool_presets_equal,
    loaded_preset_snapshot
  } from './image_tool_preset_state';
  import {
    image_render_colors,
    main_text_font_configs,
    normal_text_font_config,
    number_font_config,
    system_font_overrides,
    shaded_background_image_status,
    show_image_on_top_right,
    trans_text_font_configs,
    translation_bounding_coords
  } from './image_state';
  import { shloka_configs, SPACE_ABOVE_REFERENCE_LINE } from './settings';

  const trpc = useTRPC();
  const query_client = useQueryClient();
  const session = useSession();

  const is_logged_in = $derived(!!$session.data?.user);
  const is_admin = $derived($session.data?.user.role === 'admin');

  const presets_q = createQuery(() => ({
    ...trpc.image_tool.preset.list_presets.queryOptions(),
    enabled: is_logged_in
  }));

  const list_query_key = $derived(trpc.image_tool.preset.list_presets.queryKey());

  const upsert_mut = createMutation(() =>
    trpc.image_tool.preset.upsert_preset.mutationOptions({
      onSuccess: async () => {
        await query_client.invalidateQueries({ queryKey: list_query_key });
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to save preset');
      }
    })
  );

  const delete_mut = createMutation(() =>
    trpc.image_tool.preset.delete_preset.mutationOptions({
      onSuccess: async () => {
        await query_client.invalidateQueries({ queryKey: list_query_key });
        toast.success('Preset deleted');
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to delete preset');
      }
    })
  );

  type PresetOption = {
    id: string;
    label: string;
    config: ImageToolPresetConfig;
    is_builtin: boolean;
  };

  const preset_options = $derived.by((): PresetOption[] => {
    const builtin: PresetOption = {
      id: BUILTIN_IMAGE_TOOL_PRESET_ID,
      label: BUILTIN_IMAGE_TOOL_PRESET_NAME,
      config: get_builtin_default_image_tool_preset(),
      is_builtin: true
    };
    const server =
      presets_q.data?.map((preset) => ({
        id: preset.name,
        label: preset.name,
        config: preset.config,
        is_builtin: false
      })) ?? [];
    return [builtin, ...server];
  });

  let selected_preset_id = $state(BUILTIN_IMAGE_TOOL_PRESET_ID);

  let delete_confirm_open = $state(false);
  let update_confirm_open = $state(false);
  let save_new_open = $state(false);
  let new_preset_name = $state('');

  const selected_option = $derived(
    preset_options.find((option) => option.id === selected_preset_id) ?? preset_options[0]!
  );

  const selected_label = $derived(selected_option?.label ?? BUILTIN_IMAGE_TOOL_PRESET_NAME);

  const current_config = $derived.by(() => {
    void $SPACE_ABOVE_REFERENCE_LINE;
    void $shloka_configs;
    void $translation_bounding_coords;
    void $image_render_colors;
    void $main_text_font_configs;
    void $normal_text_font_config;
    void $trans_text_font_configs;
    void $number_font_config;
    void $system_font_overrides;
    void $show_image_on_top_right;
    void $shaded_background_image_status;
    return collect_image_tool_preset();
  });

  const is_dirty = $derived(!image_tool_presets_equal(current_config, $loaded_preset_snapshot));
  const is_server_preset = $derived(selected_preset_id !== BUILTIN_IMAGE_TOOL_PRESET_ID);
  const is_pending = $derived(upsert_mut.isPending || delete_mut.isPending);

  const select_preset = async (preset_id: string) => {
    const option = preset_options.find((entry) => entry.id === preset_id);
    if (!option) return;
    selected_preset_id = preset_id;
    const applied = await apply_image_tool_preset(option.config);
    loaded_preset_snapshot.set(copy_plain_object(applied));
  };

  const handle_preset_change = (value: string | undefined) => {
    if (!value || value === selected_preset_id) return;
    select_preset(value);
  };

  const confirm_update_preset = async () => {
    if (!is_server_preset) return;
    try {
      await upsert_mut.mutateAsync({
        name: selected_preset_id,
        config: current_config,
        update: true
      });
      loaded_preset_snapshot.set(copy_plain_object(current_config));
      update_confirm_open = false;
      toast.success('Preset updated');
    } catch {
      // toast handled by mutation
    }
  };

  const confirm_save_new_preset = async () => {
    const name = new_preset_name.trim();
    if (!name) {
      toast.error('Enter a preset name');
      return;
    }
    try {
      await upsert_mut.mutateAsync({
        name,
        config: current_config,
        update: false
      });
      selected_preset_id = name;
      loaded_preset_snapshot.set(copy_plain_object(current_config));
      save_new_open = false;
      new_preset_name = '';
      toast.success('Preset saved');
    } catch {
      // toast handled by mutation
    }
  };

  const confirm_delete_preset = async () => {
    if (!is_server_preset) return;
    const name = selected_preset_id;
    try {
      await delete_mut.mutateAsync({ name });
      select_preset(BUILTIN_IMAGE_TOOL_PRESET_ID);
      delete_confirm_open = false;
    } catch {
      // toast handled by mutation
    }
  };

  const open_save_new_dialog = () => {
    new_preset_name = '';
    save_new_open = true;
  };
</script>

{#if is_logged_in}
  <section
    class="mb-3 flex w-full flex-col gap-2.5 rounded-lg border border-border bg-muted/25 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
    aria-label="Layout presets"
  >
    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
      <div class="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Layers class="size-4 shrink-0" aria-hidden="true" />
        <span>Layout preset</span>
      </div>

      <Select.Root
        type="single"
        value={selected_preset_id}
        onValueChange={handle_preset_change}
        disabled={is_pending}
      >
        <Select.Trigger
          class="h-8 max-w-full min-w-36 flex-1 px-2.5 text-xs sm:max-w-56 sm:flex-none"
        >
          <span class="truncate">{selected_label}</span>
        </Select.Trigger>
        <Select.Content>
          {#each preset_options as option (option.id)}
            <Select.Item value={option.id}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>

      {#if is_dirty}
        <span
          class="inline-flex shrink-0 items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200"
        >
          Unsaved changes
        </span>
      {/if}
    </div>

    {#if is_admin}
      <div class="flex flex-wrap items-center gap-2 sm:ml-auto sm:shrink-0">
        {#if is_dirty && is_server_preset}
          <Button
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 px-2.5 text-xs"
            disabled={is_pending}
            onclick={() => (update_confirm_open = true)}
          >
            <Save class="size-3.5" />
            Save changes
          </Button>
        {/if}

        {#if is_dirty}
          <Button
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 px-2.5 text-xs"
            disabled={is_pending}
            onclick={open_save_new_dialog}
          >
            <Plus class="size-3.5" />
            Save as new
          </Button>
        {/if}

        {#if is_server_preset}
          <Button
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 border-destructive/30 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={is_pending}
            onclick={() => (delete_confirm_open = true)}
          >
            <Trash2 class="size-3.5" />
            Delete
          </Button>
        {/if}
      </div>
    {/if}
  </section>
{/if}

<AlertDialog.Root bind:open={delete_confirm_open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete preset?</AlertDialog.Title>
      <AlertDialog.Description>
        Delete preset <span class="font-medium text-foreground">{selected_label}</span>? This cannot
        be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={is_pending}>Cancel</AlertDialog.Cancel>
      <Button variant="destructive" disabled={is_pending} onclick={confirm_delete_preset}>
        {#if delete_mut.isPending}
          <Loader2 class="size-4 animate-spin" />
        {/if}
        Delete
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={update_confirm_open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Update preset?</AlertDialog.Title>
      <AlertDialog.Description>
        Save your current image tool settings to preset
        <span class="font-medium text-foreground">{selected_label}</span>?
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={is_pending}>Cancel</AlertDialog.Cancel>
      <Button disabled={is_pending} onclick={confirm_update_preset}>
        {#if upsert_mut.isPending}
          <Loader2 class="size-4 animate-spin" />
        {/if}
        Save changes
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<Dialog.Root bind:open={save_new_open}>
  <Dialog.Content class="max-w-sm">
    <Dialog.Header>
      <Dialog.Title>Save to new preset</Dialog.Title>
      <Dialog.Description>Save the current image tool settings as a new preset.</Dialog.Description>
    </Dialog.Header>
    <div class="space-y-2 py-2">
      <Label for="new-preset-name">Preset name</Label>
      <Input
        id="new-preset-name"
        bind:value={new_preset_name}
        placeholder="e.g. YouTube VR layout"
        disabled={is_pending}
        onkeydown={(e) => {
          if (e.key === 'Enter') confirm_save_new_preset();
        }}
      />
    </div>
    <Dialog.Footer>
      <Button variant="outline" disabled={is_pending} onclick={() => (save_new_open = false)}>
        Cancel
      </Button>
      <Button disabled={is_pending || !new_preset_name.trim()} onclick={confirm_save_new_preset}>
        {#if upsert_mut.isPending}
          <Loader2 class="size-4 animate-spin" />
        {/if}
        Save preset
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
