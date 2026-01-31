<script lang="ts">
  import { browser } from '$app/environment';
  import { get_last_level_name, get_total_count, text_data_q } from '~/state/main_app/data.svelte';
  import {
    selected_text_levels,
    BASE_SCRIPT,
    image_tool_opened,
    viewing_script,
    ai_tool_opened,
    view_translation_status,
    project_state
  } from '~/state/main_app/state.svelte';
  import { createMutation } from '@tanstack/svelte-query';
  import { RiDocumentFileExcel2Line } from 'svelte-icons-pack/ri';
  import { transliterate_xlxs_file } from '~/tools/excel/transliterate_xlsx_file';
  import { client, client_q } from '~/api/client';
  import Icon from '~/tools/Icon.svelte';
  import { BiImage } from 'svelte-icons-pack/bi';
  import type { Workbook } from 'exceljs';
  import { TrOutlineFileTypeTxt } from 'svelte-icons-pack/tr';
  import { download_file_in_browser } from '~/tools/download_file_browser';
  import { transliterate_custom } from '~/tools/converter';
  import { RiUserFacesRobot2Line } from 'svelte-icons-pack/ri';
  import { useSession } from '~/lib/auth-client';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Popover from '$lib/components/ui/popover';
  import { cn } from '$lib/utils';
  import { BsThreeDots } from 'svelte-icons-pack/bs';
  import { AiOutlineClose } from 'svelte-icons-pack/ai';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';
  import { OiCache16 } from 'svelte-icons-pack/oi';
  import { get_path_params } from '~/state/project_list';
  import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
  import { Button } from '$lib/components/ui/button';

  const session = useSession();
  let user_info = $derived($session.data?.user);

  let current_workbook = $state<Workbook>(null!);
  let current_file_name = $state<string>(null!);
  let current_dowbload_link = $state<string>(null!);
  let excel_preview_opened = $state(false);

  const download_excel_file = createMutation({
    mutationKey: ['chapter', 'download_excel_data'],
    mutationFn: async () => {
      if (!browser) return;
      // the method used below creates a url for both dev and prod
      const ExcelJS = (await import('exceljs')).default;
      const url = new URL('/src/tools/excel/template/excel_file_template.xlsx', import.meta.url)
        .href;
      const req = await fetch(url);
      const file_blob = await req.blob();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file_blob.arrayBuffer());
      const worksheet = workbook.getWorksheet(1)!;
      const COLUMN_FOR_DEV = 2;
      const TEXT_START_ROW = 2;
      const translation_texts = await client.translation.get_all_langs_translation.query({
        project_id: $project_state.project_id!,
        selected_text_levels: $selected_text_levels
      });
      const total_count = get_total_count($selected_text_levels);
      for (let i = 0; i < $text_data_q.data!.length; i++) {
        worksheet.getCell(i + COLUMN_FOR_DEV, TEXT_START_ROW).value = $text_data_q.data![i].text;
        worksheet.getCell(i + COLUMN_FOR_DEV, 1).value = i === total_count + 1 ? -1 : i;
      }
      await transliterate_xlxs_file(
        workbook,
        'all',
        1,
        COLUMN_FOR_DEV,
        TEXT_START_ROW,
        BASE_SCRIPT,
        null,
        translation_texts,
        total_count
      );

      // saving file to output path
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const name = get_last_level_name($selected_text_levels).nor.split('\n')[0];
      current_dowbload_link = URL.createObjectURL(blob);
      current_file_name = $selected_text_levels[0]
        ? `${$selected_text_levels[0]}. ${name}.xlsx`
        : `${name}.xlsx`;
      current_workbook = workbook;
      excel_preview_opened = true;
    }
  });

  const download_text_file = createMutation({
    mutationKey: ['chapter', 'download_text_data'],
    mutationFn: async () => {
      if (!browser) return;
      const text = (
        await Promise.all(
          $text_data_q.data!.map((shloka_lines) =>
            transliterate_custom(shloka_lines.text, BASE_SCRIPT, $viewing_script)
          )
        )
      ).join('\n\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const names = get_last_level_name($selected_text_levels);
      const sarga_name_normal = names.nor.split('\n')[0];
      const sarga_name_script = await transliterate_custom(
        names.dev.split('\n')[0],
        BASE_SCRIPT,
        $viewing_script
      );
      const is_not_brahmic_script = ['Normal', 'Romanized'].includes($viewing_script);
      download_file_in_browser(
        url,
        ($selected_text_levels[0] ? `${$selected_text_levels[0]} ` : '') +
          `${sarga_name_script}${is_not_brahmic_script ? '' : ` (${sarga_name_normal})`}.txt`
      );
    }
  });

  let utility_popover_state = $state(false);

  let cache_tool_modal_opened = $state(false);
</script>

<Popover.Root bind:open={utility_popover_state}>
  <Popover.Trigger class="outline-none select-none" title="Extra Options">
    <Icon class="mx-[0.17rem] text-lg sm:mx-0 sm:text-2xl" src={BsThreeDots} />
  </Popover.Trigger>
  <Popover.Content side="bottom" class="w-auto space-y-1 p-1 text-sm">
    {#if user_info}
      <Button
        variant="ghost"
        class="w-full justify-start px-2 py-1 text-sm font-normal"
        onclick={() => {
          $download_excel_file.mutate();
          utility_popover_state = false;
        }}
      >
        <Icon
          class="-mt-1 mr-1 text-2xl text-green-600 dark:text-green-400"
          src={RiDocumentFileExcel2Line}
        />
        Download Excel File
      </Button>
    {/if}
    <Button
      variant="ghost"
      class="w-full justify-start px-2 py-1 text-sm font-normal"
      onclick={() => {
        utility_popover_state = false;
        image_tool_opened.set(true);
      }}
    >
      <Icon src={BiImage} class="-mt-1 fill-sky-500 text-2xl dark:fill-sky-400" />
      Image Tool
    </Button>
    {#if user_info && user_info.role === 'admin'}
      <Button
        variant="ghost"
        class="w-full justify-start px-2 py-1 text-sm font-normal"
        onclick={() => {
          utility_popover_state = false;
          $ai_tool_opened = true;
          $view_translation_status = true;
        }}
      >
        <Icon
          src={RiUserFacesRobot2Line}
          class="-mt-1 mr-1 fill-blue-500 text-2xl dark:fill-blue-400"
        />
        AI Image Generator
      </Button>
    {/if}
    <Button
      variant="ghost"
      class="w-full justify-start px-2 py-1 text-sm font-normal"
      onclick={() => {
        utility_popover_state = false;
        $download_text_file.mutate();
      }}
    >
      <Icon src={TrOutlineFileTypeTxt} class="mr-1 text-2xl" />
      Download Text File
    </Button>
    {#if user_info && user_info.role === 'admin'}
      <Button
        variant="ghost"
        class="w-full justify-start px-2 py-1 text-sm font-normal"
        onclick={() => {
          cache_tool_modal_opened = true;
          utility_popover_state = false;
        }}
      >
        <Icon src={OiCache16} class="-mt-1 mr-1 text-xl text-yellow-600 dark:text-yellow-400" />
        Cache Tool
      </Button>
    {/if}
  </Popover.Content>
</Popover.Root>

<Dialog.Root bind:open={$image_tool_opened}>
  <Dialog.Content
    showCloseButton={false}
    class="flex h-[95vh] w-[95vw] max-w-[95vw] flex-col gap-0 p-0"
  >
    {#await import('../../image_tool/ImageTool.svelte') then ImageTool}
      <div class="flex w-full justify-end border-b p-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close"
          class="cursor-pointer text-muted-foreground hover:text-foreground"
          onclick={() => ($image_tool_opened = false)}
        >
          <Icon src={AiOutlineClose} />
        </Button>
      </div>
      <div class="flex-1 overflow-auto p-4">
        <ImageTool.default />
      </div>
    {/await}
  </Dialog.Content>
</Dialog.Root>

{#if excel_preview_opened}
  {#await import('~/components/PreviewExcel.svelte') then PreviewExcel}
    <PreviewExcel.default
      file_link={current_dowbload_link}
      file_name={current_file_name}
      bind:file_preview_opened={excel_preview_opened}
      workbook={current_workbook}
    />
  {/await}
{/if}

<Dialog.Root bind:open={cache_tool_modal_opened}>
  <Dialog.Content class="max-w-md">
    {#await import('./CacheTool.svelte') then CacheTool}
      <CacheTool.default />
    {/await}
  </Dialog.Content>
</Dialog.Root>
