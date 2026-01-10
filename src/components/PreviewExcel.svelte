<script lang="ts">
  import Icon from '~/tools/Icon.svelte';
  import { RiSystemDownloadLine } from 'svelte-icons-pack/ri';
  import { Modal, Tabs } from '@skeletonlabs/skeleton-svelte';
  import type { Workbook, Worksheet } from 'exceljs';
  import { getNormalizedScriptName, type ScriptLangType } from 'lipilekhika';
  import { get_text_font_class } from '~/tools/font_tools';
  import type { script_and_lang_list_type } from '~/state/lang_list';
  import { AiOutlineClose } from 'svelte-icons-pack/ai';

  type Props = {
    file_link: string;
    workbook: Workbook;
    file_name: string;
    file_preview_opened: boolean;
  };

  let { file_link, workbook, file_name, file_preview_opened = $bindable() }: Props = $props();

  let sheet_number = $state('0');

  const get_lang_code_of_columnn = (worksheet: Worksheet, column_i: number) => {
    const lang = getNormalizedScriptName(
      (worksheet.getCell(1, column_i + 1).value?.toLocaleString() ?? '').split(' ')[0] as ScriptLangType
    ) as script_and_lang_list_type;
    return lang || '';
  };

  let overflow_behavior: 'hidden' | 'scroll' = $state('hidden');
</script>

<div>
  <Modal
    open={file_preview_opened}
    onOpenChange={(e) => (file_preview_opened = e.open)}
    closeOnInteractOutside={false}
    backdropBackground="backdrop-blur-xs"
    contentBase="z-50 mx-3 max-h-[97%] max-w-[97%] overflow-scroll card rounded-lg bg-stone-100 p-1 shadow-2xl dark:bg-surface-900"
  >
    {#snippet content()}
      <div class="flex w-[97%] justify-end">
        <button
          aria-label="Close"
          class="absolute cursor-pointer text-gray-500 hover:text-gray-700"
          onclick={() => (file_preview_opened = false)}><Icon src={AiOutlineClose} /></button
        >
      </div>
      <article class="overflow-scroll rounded-lg p-3 pt-2 shadow-lg">
        <div class="ml-4 flex space-x-4 select-none">
          <span class="text-2xl">
            <a href={file_link} class="ml-2" download={file_name}>
              <Icon
                src={RiSystemDownloadLine}
                class="text-blue-800 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-500"
              />
            </a>
          </span>
          <label class="space-x-1">
            <span>Overflow</span>
            <select class="select inline-block w-24 p-1" bind:value={overflow_behavior}>
              <option value="hidden">Hidden</option>
              <option value="scroll">Scroll</option>
            </select>
          </label>
        </div>
        <Tabs value={sheet_number} onValueChange={(e) => (sheet_number = e.value)}>
          {#snippet list()}
            {#each workbook.worksheets as worksheet, i}
              <Tabs.Control value={i.toString()}>
                <span class="font-bold">{worksheet.name}</span>
              </Tabs.Control>
            {/each}
          {/snippet}
          {#snippet content()}
            {@const worksheet = workbook.worksheets[parseInt(sheet_number)]}
            <div class="overflow-x-scroll">
              <table class="table-compact table-cell-fit table">
                <thead>
                  <tr>
                    {#each Array(worksheet.columnCount) as _, i}
                      {@const row_value = worksheet.getCell(1, i + 1).value}
                      <th class="text-center">{row_value ?? ''}</th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each Array(worksheet.rowCount) as _, row_i}
                    <tr>
                      {#each Array(worksheet.columnCount) as _, column_i}
                        {@const row_value =
                          worksheet.getCell(row_i + 2, column_i + 1).value?.toLocaleString() ?? ''}
                        {@const lang = get_lang_code_of_columnn(worksheet, column_i)}
                        <td>
                          <pre
                            class={`${get_text_font_class(lang)} max-w-72 scroll-m-0 ${overflow_behavior === 'scroll' ? 'overflow-scroll' : 'overflow-hidden'} text-sm`}>{row_value}</pre>
                        </td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/snippet}
        </Tabs>
      </article>
    {/snippet}
  </Modal>
</div>
