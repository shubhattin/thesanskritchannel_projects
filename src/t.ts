import { YAML } from 'bun';
import { translate_func } from './api/routes/ai/translate_funs';
import { lang_list_obj, type lang_list_type } from './state/lang_list';
import { format_string_text } from './tools/kry';
import { encode } from '@toon-format/toon';
import chalk from 'chalk';
import { get_project_from_key, type project_keys_type } from './state/project_list';
import * as fs from 'fs';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

const project_key: project_keys_type = 'ramayanam';
const project_info = get_project_from_key(project_key);
const project_id = project_info.id;
const project_name = project_info.name;

const lang: lang_list_type = 'Telugu';
const lang_id = lang_list_obj[lang];

const trans_prompts = (await YAML.parse(
  await Bun.file('./components/pages/main_app/display/ai_translate/translation_prompts.yaml').text()
)) as any;

const translate = async (
  texts_obj_list: {
    english_translation?: string | undefined;
    index: number;
    text: string;
  }[]
) => {
  const res = await translate_func({
    project_id: project_id,
    lang_id: lang_id,
    model: 'gpt-5.2',
    messages: [
      {
        role: 'user',
        content: format_string_text(
          // @ts-ignore
          lang === 'English'
            ? trans_prompts.prompts_english[0].content
            : trans_prompts.prompts[0].content,
          {
            text_name: project_name,
            text: encode(texts_obj_list),
            lang: lang
          }
        )
      }
    ]
  });
  return res;
};

let failed_paths: string[] = [];
const translate_sarga = async (sarga_num: number, kanda_num: number) => {
  const db_path = `${kanda_num}:${sarga_num}`;
  const data: {
    text: string;
    index: number;
    shloka_num: number | null;
  }[] = await Bun.file(`../data/1. ramayanam/data/${kanda_num}/${sarga_num}.json`).json();
  const texts_obj_list = data.map((item) => ({
    index: item.index,
    text: item.text
  }));
  const res = await translate(texts_obj_list);
  if (!res.success) {
    failed_paths.push(db_path);
    return;
  }
  const db_format = res.translations!.map((val) => ({
    project_id: project_id,
    lang_id: lang_id,
    path: db_path,
    ...val
  }));
  const save_path_dir = `./trans/${lang}`;
  fs.mkdirSync(save_path_dir, { recursive: true });
  const save_path = `${save_path_dir}/${db_path}.json`;
  fs.writeFileSync(save_path, JSON.stringify(db_format, null, 2));
  // return db_format;
};

const KANDA_SARGA_RANGE_RANGE: [number, [number, number]][] = [
  // [1, [31, 77]],
  // [2, [1, 119]],
  // [3, [1, 75]],
  // [4, [1, 67]],
  // [5, [1, 68]],
  // [6, [1, 131]],
  // [7, [1, 111]]
  [6, [67, 67]],
  [6, [73, 73]]
];
for (const [kanda_num, SARGA_RANGE] of KANDA_SARGA_RANGE_RANGE) {
  failed_paths = [];
  const limit = pLimit(30); // Max 15 concurrent tasks
  console.log(chalk.green('Kanda num: ' + chalk.yellow.bold(kanda_num)));
  console.log(
    chalk.green('Sarga range: ' + chalk.yellow.bold(`${SARGA_RANGE[0]} to ${SARGA_RANGE[1]}`))
  );
  // Create progress bar
  const totalTasks = SARGA_RANGE[1] - SARGA_RANGE[0] + 1;
  const progressBar = new cliProgress.SingleBar(
    {
      format: 'Progress |' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} Sargas',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    },
    cliProgress.Presets.shades_classic
  );

  progressBar.start(totalTasks, 0);

  const promises = [];
  for (let sarga_num = SARGA_RANGE[0]; sarga_num <= SARGA_RANGE[1]; sarga_num++) {
    promises.push(
      limit(async () => {
        await translate_sarga(sarga_num, kanda_num);
        progressBar.increment();
      })
    );
  }
  await Promise.all(promises);

  progressBar.stop();

  if (failed_paths.length > 0) {
    console.log(chalk.red('Failed count: ' + chalk.yellow.bold(failed_paths.length)));
    console.log(chalk.red('Failed paths: ' + chalk.yellow.bold(failed_paths.join(', '))));
    Bun.write(`./trans/failed_${kanda_num}.txt`, failed_paths.join('\n'));
  }

  // Send desktop notification
  Bun.spawn([
    'notify-send',
    `"Automations Done for ${kanda_num} from ${SARGA_RANGE[0]} to ${SARGA_RANGE[1]}"`
  ]);
}
