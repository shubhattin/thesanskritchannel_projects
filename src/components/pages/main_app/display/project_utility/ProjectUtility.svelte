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
  import { lipi_parivartak } from '~/tools/converter';
  import { RiUserFacesRobot2Line } from 'svelte-icons-pack/ri';
  import { useSession } from '~/lib/auth-client';
  import { Modal, Popover } from '@skeletonlabs/skeleton-svelte';
  import { cl_join } from '~/tools/cl_join';
  import { BsThreeDots } from 'svelte-icons-pack/bs';
  import { AiOutlineClose } from 'svelte-icons-pack/ai';
  import ConfirmModal from '~/components/PopoverModals/ConfirmModal.svelte';
  import { OiCache16 } from 'svelte-icons-pack/oi';
  import { get_path_params } from '~/state/project_list';
  import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';

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
            lipi_parivartak(shloka_lines.text, BASE_SCRIPT, $viewing_script)
          )
        )
      ).join('\n\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const names = get_last_level_name($selected_text_levels);
      const sarga_name_normal = names.nor.split('\n')[0];
      const sarga_name_script = await lipi_parivartak(
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

  const invalidate_cache_mut = client_q.cache.invalidate_cache.mutation({
    onSuccess() {
      setTimeout(() => {
        window.location.reload();
      }, 600);
    }
  });

  let invalidate_cache_confirm_modal_state = $state(false);
</script>

<Popover
  open={utility_popover_state}
  onOpenChange={(e) => (utility_popover_state = e.open)}
  positioning={{ placement: 'bottom' }}
  arrow={false}
  contentBase={cl_join(
    'card z-70 space-y-1 p-1 rounded-lg shadow-xl dark:bg-surface-900 bg-zinc-100 text-sm'
  )}
>
  {#snippet trigger()}
    <span class="btn outline-hidden select-none" title="Extra Options">
      <Icon class="mx-[0.17rem] text-lg sm:mx-0 sm:text-2xl" src={BsThreeDots} />
    </span>
  {/snippet}
  {#snippet content()}
    {#if user_info && user_info.is_approved}
      <button
        onclick={() => {
          $download_excel_file.mutate();
          utility_popover_state = false;
        }}
        class="btn block w-full rounded-md px-2 py-1 pt-0 hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <Icon
          class="-mt-1 mr-1 text-2xl text-green-600 dark:text-green-400"
          src={RiDocumentFileExcel2Line}
        />
        Download Excel File
      </button>
    {/if}
    <button
      onclick={() => {
        utility_popover_state = false;
        image_tool_opened.set(true);
      }}
      class="btn block w-full rounded-md px-2 py-1 pt-0 text-start hover:bg-gray-200 dark:hover:bg-gray-700"
    >
      <Icon src={BiImage} class="-mt-1 fill-sky-500 text-2xl dark:fill-sky-400" />
      Image Tool
    </button>
    {#if user_info && user_info.role === 'admin'}
      <button
        onclick={() => {
          utility_popover_state = false;
          $ai_tool_opened = true;
          $view_translation_status = true;
        }}
        class="btn block w-full rounded-md px-2 py-1 pt-0 text-start hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <Icon
          src={RiUserFacesRobot2Line}
          class="-mt-1 mr-1 fill-blue-500 text-2xl dark:fill-blue-400"
        />
        AI Image Generator
      </button>
    {/if}
    <button
      class="btn block w-full rounded-md px-2 py-1 pt-0 text-start hover:bg-gray-200 dark:hover:bg-gray-700"
      onclick={() => {
        utility_popover_state = false;
        $download_text_file.mutate();
      }}
    >
      <Icon src={TrOutlineFileTypeTxt} class=" mr-1 text-2xl" />
      Download Text File
    </button>
    {#if user_info && user_info.role === 'admin'}
      <button
        onclick={() => {
          invalidate_cache_confirm_modal_state = true;
          utility_popover_state = false;
        }}
        class="btn block w-full rounded-md px-2 py-1 pt-0 text-start hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <Icon src={OiCache16} class="-mt-1 mr-1 text-xl text-yellow-600 dark:text-yellow-400" />
        Invalidate Text Cache
      </button>
    {/if}
  {/snippet}
</Popover>
<Modal
  open={$image_tool_opened}
  onOpenChange={(e) => ($image_tool_opened = e.open)}
  closeOnInteractOutside={true}
  contentBase="z-10 mx-3 max-h-[97%] max-w-[97%] overflow-scroll rounded-md p-2 card rounded-lg bg-slate-100 p-1 shadow-2xl dark:bg-surface-900"
  backdropBackground="backdrop-blur-xs"
>
  {#snippet content()}
    {#await import('../../image_tool/ImageTool.svelte') then ImageTool}
      <div class="flex w-[98%] justify-end">
        <button
          aria-label="Close"
          class="absolute cursor-pointer text-gray-500 hover:text-gray-700"
          onclick={() => ($image_tool_opened = false)}><Icon src={AiOutlineClose} /></button
        >
      </div>
      <ImageTool.default />
    {/await}
  {/snippet}
</Modal>
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
<ConfirmModal
  bind:popup_state={invalidate_cache_confirm_modal_state}
  close_on_confirm={true}
  title="Sure to Invalidate Cache ?"
  body_text={() => {
    const path_params = get_path_params($selected_text_levels, $project_state.levels).join('.');
    return `This will invalidate the text data cache for ${path_params}`;
  }}
  confirm_func={async () => {
    await $invalidate_cache_mut.mutateAsync({
      cache_keys: [
        REDIS_CACHE_KEYS_CLIENT.text_data(
          $project_state.project_id!,
          get_path_params($selected_text_levels, $project_state.levels)
        )
      ]
    });
  }}
></ConfirmModal>
