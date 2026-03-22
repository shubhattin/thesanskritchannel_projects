<script lang="ts">
  import Icon from '~/tools/Icon.svelte';
  import { RiSystemDownloadLine } from 'svelte-icons-pack/ri';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Tabs from '$lib/components/ui/tabs';
  import type { Workbook, Worksheet } from 'exceljs';
  import { getNormalizedScriptName, type ScriptLangType } from 'lipilekhika';
  import { get_text_font_class } from '~/tools/font_tools';
  import type { script_and_lang_list_type } from '~/state/lang_list';
  import * as Select from '$lib/components/ui/select';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
  } from '$lib/components/ui/table';

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
      (worksheet.getCell(1, column_i + 1).value?.toLocaleString() ?? '').split(
        ' '
      )[0] as ScriptLangType
    ) as script_and_lang_list_type;
    return lang || '';
  };

  let overflow_behavior: 'hidden' | 'scroll' = $state('hidden');
</script>

<Dialog.Root bind:open={file_preview_opened}>
  <Dialog.Content class="h-[95vh] w-[95vw] max-w-[95vw] overflow-auto p-3 sm:max-w-[95vw]">
    <article class="overflow-auto rounded-lg p-3 pt-2">
      <div class="ml-4 flex items-center gap-4 select-none">
        <span class="text-2xl">
          <a href={file_link} class="ml-2" download={file_name}>
            <Icon
              src={RiSystemDownloadLine}
              class="text-blue-800 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-500"
            />
          </a>
        </span>
        <label class="flex items-center gap-1">
          <span>Overflow</span>
          <Select.Root type="single" bind:value={overflow_behavior as any}>
            <Select.Trigger class="w-24 px-2 py-1 text-sm">
              {overflow_behavior === 'hidden' ? 'Hidden' : 'Scroll'}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="hidden">Hidden</Select.Item>
              <Select.Item value="scroll">Scroll</Select.Item>
            </Select.Content>
          </Select.Root>
        </label>
      </div>
      <Tabs.Root bind:value={sheet_number} class="mt-4">
        <Tabs.List>
          {#each workbook.worksheets as worksheet, i}
            <Tabs.Trigger value={i.toString()}>
              <span class="font-bold">{worksheet.name}</span>
            </Tabs.Trigger>
          {/each}
        </Tabs.List>
        {#each workbook.worksheets as _, i}
          <Tabs.Content value={i.toString()}>
            {@const worksheet = workbook.worksheets[i]}
            <Table class="border-collapse border border-border text-sm">
              <TableHeader>
                <TableRow>
                  {#each Array(worksheet.columnCount) as _, colIdx}
                    {@const row_value = worksheet.getCell(1, colIdx + 1).value}
                    <TableHead
                      class="border border-border bg-muted px-2 py-1 text-center font-semibold"
                    >
                      {row_value ?? ''}
                    </TableHead>
                  {/each}
                </TableRow>
              </TableHeader>
              <TableBody>
                {#each Array(worksheet.rowCount) as _, row_i}
                  <TableRow>
                    {#each Array(worksheet.columnCount) as _, column_i}
                      {@const row_value =
                        worksheet.getCell(row_i + 2, column_i + 1).value?.toLocaleString() ?? ''}
                      {@const lang = get_lang_code_of_columnn(worksheet, column_i)}
                      <TableCell class="border border-border px-2 py-1">
                        <pre
                          class={`${get_text_font_class(lang)} max-w-72 scroll-m-0 ${overflow_behavior === 'scroll' ? 'overflow-auto' : 'overflow-hidden'} text-sm`}>{row_value}</pre>
                      </TableCell>
                    {/each}
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
          </Tabs.Content>
        {/each}
      </Tabs.Root>
    </article>
  </Dialog.Content>
</Dialog.Root>
