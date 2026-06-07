import Konva from 'konva';
import {
  image_shloka,
  image_shloka_data,
  image_text_data_q_options,
  image_trans_data_q_options,
  image_lang as image_lang_store,
  image_selected_levels,
  main_text_font_configs,
  normal_text_font_config,
  trans_text_font_configs,
  image_render_colors,
  image_trans_text,
  show_image_on_top_right,
  translation_bounding_coords
} from './image_state';
import {
  IMAGE_RENDER_COLORS,
  shloka_configs,
  SPACE_ABOVE_REFERENCE_LINE,
  type shloka_type_config,
  type shloka_number_type
} from './settings';
import { get } from 'svelte/store';
import { browser } from '$app/environment';
import {
  LANG_LIST,
  LANG_LIST_IDS,
  type lang_list_type,
  type script_list_type
} from '~/state/lang_list';
import { transliterate_custom } from '~/tools/converter';
import { FONT_FAMILY_NAME } from '~/tools/font_tools';
import { BASE_SCRIPT, project_state, text_data_present } from '~/state/main_app/state.svelte';
import { queryClient } from '~/state/queryClient';
import type { ScriptLangType } from 'lipilekhika';
import { ensure_fonts_loaded, get_font_load_descriptors } from './font_loader';

// --- Types ---

export type KonvaTextConfig = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
  fill: string;
  align: 'left' | 'center' | 'right';
  width?: number;
  wrap?: 'word' | 'char' | 'none';
  lineHeight?: number;
  listening: boolean;
};

export type KonvaLineConfig = {
  id: string;
  points: number[];
  stroke: string;
  strokeWidth: number;
  listening: boolean;
};

export type CanvasLayoutResult = {
  texts: KonvaTextConfig[];
  bounding_lines: KonvaLineConfig[];
  reference_lines: KonvaLineConfig[];
  shloka_config: shloka_type_config;
  shloka_type: shloka_number_type;
};

// --- Text measurement helpers using Konva ---

/**
 * Measures the width of a single-line text string using a temporary Konva.Text node.
 * This replaces the old HarfBuzz SVG path measurement.
 */
function measure_text_width(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontStyle: string
): number {
  const tmp = new Konva.Text({
    text,
    fontSize,
    fontFamily,
    fontStyle
  });
  const w = tmp.getTextWidth();
  tmp.destroy();
  return w;
}

/**
 * Measures the height of a single-line text string.
 */
function measure_text_height(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontStyle: string
): number {
  const tmp = new Konva.Text({
    text,
    fontSize,
    fontFamily,
    fontStyle
  });
  const h = tmp.height();
  tmp.destroy();
  return h;
}

// --- Core text fitting algorithm ---

type FitTextOpts = {
  text: string;
  fontFamily: string;
  fontStyle: string;
  baseFontSize: number;
  fontScale: number;
  color: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  widthUsageFactor: number;
  align: 'left' | 'center' | 'right';
  multiLine: boolean;
  newLineSpacingFactor: number;
  lineIndex?: number;
  totalLines?: number;
  textType?: 'main' | 'normal';
  /** When false, last-line number words stay in the shloka body (no extraction). */
  showNumberIndicator?: boolean;
  textForMinHeight?: string | null;
  id: string;
};

type FitTextResult = {
  configs: KonvaTextConfig[];
  totalHeight: number;
  totalWidth: number;
};

/**
 * Computes text layout config(s) that fit within a bounding box.
 *
 * For single-line text: produces one KonvaTextConfig with fontSize scaled to fit width.
 * For multi-line text: wraps and produces one KonvaTextConfig per visual line,
 *   iteratively shrinking fontScale until all lines fit within the bounding height.
 *
 * This replaces the old HarfBuzz-based render_text function.
 */
function compute_fitted_text(opts: FitTextOpts): FitTextResult {
  const {
    text,
    fontFamily,
    fontStyle,
    baseFontSize,
    color,
    widthUsageFactor,
    align,
    multiLine,
    newLineSpacingFactor,
    lineIndex,
    totalLines,
    textType,
    showNumberIndicator = true,
    textForMinHeight,
    id
  } = opts;
  let fontScale = opts.fontScale;

  const WIDTH_ACTUAL = opts.right - opts.left;
  const WIDTH = WIDTH_ACTUAL * widthUsageFactor;
  const WIDTH_SPACING = (WIDTH_ACTUAL - WIDTH) / 2;
  const HEIGHT_ACTUAL = opts.bottom - opts.top;

  // Process text: strip last word from last shloka line for main text (number indicator)
  let textUsed = '';
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === '') continue;
    else if (
      showNumberIndicator &&
      lineIndex !== undefined &&
      totalLines !== undefined &&
      textType &&
      i === words.length - 1 &&
      lineIndex === totalLines - 1
    ) {
      if (textType === 'main') textUsed += word[0];
      continue;
    }
    textUsed += word + (i === words.length - 1 ? '' : ' ');
  }

  const FONT_SCALE_STEP = 0.05;
  const inputLines = textUsed.split('\n');

  const compute_font_size = (scale: number) => baseFontSize * scale;

  const measure_w = (str: string, fontSize: number) =>
    measure_text_width(str, fontSize, fontFamily, fontStyle);

  const measure_h = (str: string, fontSize: number) =>
    measure_text_height(str, fontSize, fontFamily, fontStyle);

  const scale_to_fit_width = (fontSize: number, textWidth: number) =>
    textWidth <= WIDTH ? fontSize : (WIDTH / textWidth) * fontSize;

  // Wrap a line into segments that each fit within WIDTH at the given fontSize
  const wrap_line_to_segments = (line: string, fontSize: number): string[] => {
    const lineWords = line.split(' ');
    const segments: string[] = [];
    let allowed: string[] = [];
    for (const word of lineWords) {
      const candidate = allowed.length > 0 ? allowed.join(' ') + ' ' + word : word;
      const w = measure_w(candidate, fontSize);
      if (w <= WIDTH) {
        allowed.push(word);
      } else {
        if (allowed.length > 0) segments.push(allowed.join(' '));
        allowed = [word];
      }
    }
    if (allowed.length > 0) segments.push(allowed.join(' '));
    return segments;
  };

  // Compute x position for a text element based on alignment
  const compute_x = (textWidth: number): number => {
    if (align === 'center') return opts.left + WIDTH_SPACING + (WIDTH - textWidth) / 2;
    if (align === 'left') return opts.left + WIDTH_SPACING;
    // right
    return opts.right - WIDTH_SPACING - textWidth;
  };

  // --- Main fitting loop ---
  for (let iter = 0; ; iter++) {
    const netScale = fontScale - iter * FONT_SCALE_STEP;
    if (netScale <= 0) break; // safety
    const fontSize = compute_font_size(netScale);
    const lineSpacing = fontSize * newLineSpacingFactor;

    if (!multiLine) {
      // Single-line text
      const textWidth = measure_w(inputLines[0] ?? '', fontSize);
      const fittedFontSize = scale_to_fit_width(fontSize, textWidth);
      const fittedWidth = measure_w(inputLines[0] ?? '', fittedFontSize);

      // Height: use textForMinHeight reference string if provided (for consistent line heights)
      let textHeight: number;
      if (textForMinHeight) {
        textHeight = measure_h((inputLines[0] ?? '') + textForMinHeight, fittedFontSize);
      } else {
        textHeight = measure_h(inputLines[0] ?? '', fittedFontSize);
      }

      const x = compute_x(fittedWidth);
      const configs: KonvaTextConfig[] = [
        {
          id,
          text: inputLines[0] ?? '',
          x,
          y: opts.top, // will be repositioned by caller for reference line alignment
          fontSize: fittedFontSize,
          fontFamily,
          fontStyle,
          fill: color,
          align: 'left', // We position manually via x, so use 'left' for Konva
          listening: false
        }
      ];
      return { configs, totalHeight: textHeight, totalWidth: fittedWidth };
    }

    // Multi-line text: wrap all input lines, find uniform scale, check height
    const wrappedSegments: string[] = [];
    for (const line of inputLines) {
      wrappedSegments.push(...wrap_line_to_segments(line, fontSize));
    }

    // Find the fontSize that fits the widest segment
    let fittedFontSize = fontSize;
    for (const segment of wrappedSegments) {
      const segW = measure_w(segment, fittedFontSize);
      if (segW > WIDTH) {
        fittedFontSize = (WIDTH / segW) * fittedFontSize;
      }
    }

    const fittedLineSpacing = lineSpacing * (fittedFontSize / fontSize);

    // Compute total height
    let totalHeight = 0;
    const segmentHeights: number[] = [];
    for (const segment of wrappedSegments) {
      let h: number;
      if (textForMinHeight) {
        h = measure_h(segment + textForMinHeight, fittedFontSize);
      } else {
        h = measure_h(segment, fittedFontSize);
      }
      segmentHeights.push(h);
      totalHeight += h;
    }
    totalHeight += fittedLineSpacing * Math.max(0, wrappedSegments.length - 1);

    if (totalHeight > HEIGHT_ACTUAL && HEIGHT_ACTUAL > 0) {
      // Doesn't fit — try smaller scale
      continue;
    }

    // Build configs
    const configs: KonvaTextConfig[] = [];
    let yOffset = opts.top;
    let maxWidth = 0;
    for (let si = 0; si < wrappedSegments.length; si++) {
      const segment = wrappedSegments[si];
      const segW = measure_w(segment, fittedFontSize);
      maxWidth = Math.max(maxWidth, segW);
      const x = compute_x(segW);
      configs.push({
        id: `${id}_line${si}`,
        text: segment,
        x,
        y: yOffset,
        fontSize: fittedFontSize,
        fontFamily,
        fontStyle,
        fill: color,
        align: 'left',
        listening: false
      });
      yOffset += segmentHeights[si] + fittedLineSpacing;
    }

    return { configs, totalHeight, totalWidth: maxWidth };
  }

  // Fallback: return empty if nothing fits
  return { configs: [], totalHeight: 0, totalWidth: 0 };
}

// --- Wrapped text for translation (delegates word-wrap to Konva) ---

type WrappedTextOpts = {
  text: string;
  fontFamily: string;
  fontStyle: string;
  baseFontSize: number;
  fontScale: number;
  color: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  widthUsageFactor: number;
  align: 'left' | 'center' | 'right';
  /** Konva lineHeight multiplier (1.0 = default single-spaced). */
  lineHeight: number;
  id: string;
};

/**
 * Computes a single KonvaTextConfig for multi-line wrapped text (e.g. translation).
 *
 * Unlike compute_fitted_text (used for shloka lines), this does NOT iteratively
 * shrink the font to fit the bounding box. Instead, `baseFontSize * fontScale`
 * is used directly as the fontSize, and Konva handles word-wrapping via
 * `width` + `wrap: 'word'`.
 *
 * This means the "Translation text size" control directly and immediately
 * changes the rendered font size, and text reflows naturally across lines.
 */
function compute_wrapped_text(opts: WrappedTextOpts): FitTextResult {
  const {
    text,
    fontFamily,
    fontStyle,
    baseFontSize,
    fontScale,
    color,
    widthUsageFactor,
    align,
    lineHeight,
    id
  } = opts;

  const WIDTH_ACTUAL = opts.right - opts.left;
  const WIDTH = WIDTH_ACTUAL * widthUsageFactor;
  const WIDTH_SPACING = (WIDTH_ACTUAL - WIDTH) / 2;
  const HEIGHT_ACTUAL = opts.bottom - opts.top;

  // Start with the desired fontSize; shrink only if it overflows the bounding box
  let fontSize = baseFontSize * fontScale;

  const measure = (fs: number) => {
    const tmp = new Konva.Text({
      text,
      fontSize: fs,
      fontFamily,
      fontStyle,
      width: WIDTH,
      wrap: 'word',
      lineHeight,
      align
    });
    const h = tmp.height();
    const w = tmp.getTextWidth();
    tmp.destroy();
    return { h, w };
  };

  // Shrink by 1px steps if text overflows the bounding box height
  if (HEIGHT_ACTUAL > 0) {
    while (fontSize > 1) {
      const { h } = measure(fontSize);
      if (h <= HEIGHT_ACTUAL) break;
      fontSize -= 1;
    }
  }

  const { h: totalHeight, w: totalWidth } = measure(fontSize);

  const x = opts.left + WIDTH_SPACING;
  const config: KonvaTextConfig = {
    id,
    text,
    x,
    y: opts.top,
    fontSize,
    fontFamily,
    fontStyle,
    fill: color,
    align,
    width: WIDTH,
    wrap: 'word',
    lineHeight,
    listening: false
  };
  return { configs: [config], totalHeight, totalWidth };
}

// --- Bounding box and reference line computation ---

function compute_lines(
  shloka_config: shloka_type_config,
  shloka_type: number,
  translation_coords: { left: number; top: number; right: number; bottom: number }
): {
  bounding_lines: KonvaLineConfig[];
  reference_lines: KonvaLineConfig[];
} {
  const shloka = shloka_config.bounding_coords;
  const trans = translation_coords;

  const bounding_line_coords = [
    // Shloka bounding box
    [shloka.left, shloka.top, shloka.left, shloka.bottom],
    [shloka.right, shloka.top, shloka.right, shloka.bottom],
    [shloka.left, shloka.top, shloka.right, shloka.top],
    [shloka.left, shloka.bottom, shloka.right, shloka.bottom],
    // Translation bounding box
    [trans.left, trans.top, trans.left, trans.bottom],
    [trans.right, trans.top, trans.right, trans.bottom],
    [trans.left, trans.top, trans.right, trans.top],
    [trans.left, trans.bottom, trans.right, trans.bottom]
  ];

  const bounding_lines: KonvaLineConfig[] = bounding_line_coords.map((coords, i) => ({
    id: `bounding_line_${i}`,
    points: coords,
    stroke: IMAGE_RENDER_COLORS.line.boundingBox,
    strokeWidth: 1.5,
    listening: false
  }));

  const reference_lines: KonvaLineConfig[] = [];
  for (let i = 0; i < shloka_type; i++) {
    const top = shloka_config.reference_lines.top + i * shloka_config.reference_lines.spacing;
    reference_lines.push({
      id: `ref_line_${i}`,
      points: [shloka.left, top, shloka.right, top],
      stroke: IMAGE_RENDER_COLORS.line.referenceLine,
      strokeWidth: 2,
      listening: false
    });
  }

  return { bounding_lines, reference_lines };
}

// --- Main layout computation (replaces render_all_texts) ---

/**
 * Computes all text and line layout data for a given shloka.
 * This is the pure computation function — no side effects, no canvas mutation.
 * Used by both the reactive UI (ImageTool.svelte) and the export pipeline (ImageDownloader).
 */
export const compute_all_layouts = async (
  shloka_index: number | null,
  image_script: script_list_type,
  image_lang_id: number,
  /** When true, always use raw query data (not editable stores). Used for bulk export. */
  use_raw_data = false
): Promise<CanvasLayoutResult | null> => {
  const image_lang = LANG_LIST[LANG_LIST_IDS.indexOf(image_lang_id)] as lang_list_type;
  const $shloka_configs = get(shloka_configs);
  const $main_text_font_configs = get(main_text_font_configs);
  const $trans_text_font_configs = get(trans_text_font_configs);
  const $normal_text_font_config = get(normal_text_font_config);
  const $SPACE_ABOVE_REFERENCE_LINE = get(SPACE_ABOVE_REFERENCE_LINE);
  const $translation_bounding_coords = get(translation_bounding_coords);
  const project = get(project_state);
  if (!project) return null;
  const $project_key = project.project_key;
  const $project_levels = project.levels;
  const $image_selected_levels = get(image_selected_levels);
  const $text_data_present = get(text_data_present);

  const shloka_val = shloka_index === null ? get(image_shloka) : shloka_index;

  if (!browser) return null;

  const main_text_font_info = $main_text_font_configs[image_script];
  const trans_text_font_info = $trans_text_font_configs[image_lang];
  const norm_text_font_info = $normal_text_font_config;
  const SPACE_BETWEEN_MAIN_AND_NORM = main_text_font_info.space_between_main_and_normal;

  const $image_sarga_data = {
    data: queryClient.getQueryData(
      image_text_data_q_options($image_selected_levels, project, $text_data_present).queryKey
    )
  };

  // Ensure fonts are loaded via browser's native API
  await ensure_fonts_loaded([
    get_font_load_descriptors(norm_text_font_info.key, 'normal'),
    get_font_load_descriptors(main_text_font_info.key, 'bold'),
    get_font_load_descriptors('ROBOTO', 'bold'),
    get_font_load_descriptors(trans_text_font_info.key, 'normal')
  ]);

  // Shloka data: editor stores for preview/current shloka, query data for bulk exports
  const selected_shloka = get(image_shloka);
  const use_editable = !use_raw_data && (shloka_index === null || shloka_val === selected_shloka);
  const shloka_data = use_editable ? get(image_shloka_data) : $image_sarga_data.data?.[shloka_val];

  if (!shloka_data) return null;

  const show_shloka_number = get(show_image_on_top_right);

  // Ramayanam special word splitting + standard newline split
  const shloka_lines = (() => {
    if ($project_key === 'ramayanam') {
      if (shloka_val === 0) {
        const words = shloka_data.text.split(' ');
        return [words.slice(0, 3).join(' '), words.slice(3).join(' ')];
      } else if (shloka_val === $image_sarga_data.data!.length - 1) {
        const words = shloka_data.text.split(' ');
        return [words.slice(0, 4).join(' '), words.slice(4).join(' ')];
      }
    }
    // We are not splitting words as it leads to inconsistent unexpected results
    return shloka_data.text.split('\n');
  })();

  const shloka_type = shloka_lines.length as keyof typeof $shloka_configs;
  const shloka_config = $shloka_configs[shloka_type];

  const colors = get(image_render_colors);
  const texts: KonvaTextConfig[] = [];

  // Font families from keys
  const mainFontFamily = FONT_FAMILY_NAME[main_text_font_info.key];
  const normFontFamily = FONT_FAMILY_NAME[norm_text_font_info.key];
  const transFontFamily = FONT_FAMILY_NAME[trans_text_font_info.key];
  const robotoFamily = FONT_FAMILY_NAME['ROBOTO'];

  const [main_texts, norm_texts] = await Promise.all([
    transliterate_custom(shloka_lines, BASE_SCRIPT, image_script as ScriptLangType),
    transliterate_custom(shloka_lines, BASE_SCRIPT, 'Normal' as ScriptLangType)
  ]);

  // --- Shloka lines ---
  for (let line_i = 0; line_i < shloka_lines.length; line_i++) {
    const main_text = main_texts[line_i];
    const norm_text = norm_texts[line_i];

    // Main text
    const mainResult = compute_fitted_text({
      text: main_text,
      fontFamily: mainFontFamily,
      fontStyle: 'bold',
      baseFontSize: shloka_config.main_text_font_size,
      fontScale: main_text_font_info.size,
      color: colors.main,
      lineIndex: line_i,
      totalLines: shloka_lines.length,
      textType: 'main',
      showNumberIndicator: show_shloka_number,
      textForMinHeight: main_text_font_info.text_for_min_height,
      ...shloka_config.bounding_coords,
      widthUsageFactor: 0.985,
      align: 'center',
      multiLine: false,
      newLineSpacingFactor: 1,
      id: `main_text_${line_i}`
    });

    // Normal text
    const normResult = compute_fitted_text({
      text: norm_text,
      fontFamily: normFontFamily,
      fontStyle: 'normal',
      baseFontSize: shloka_config.norm_text_font_size,
      fontScale: norm_text_font_info.size,
      color: colors.normal,
      lineIndex: line_i,
      totalLines: shloka_lines.length,
      textType: 'normal',
      showNumberIndicator: show_shloka_number,
      textForMinHeight: norm_text_font_info.text_for_min_height,
      ...shloka_config.bounding_coords,
      widthUsageFactor: 0.985,
      align: 'center',
      multiLine: false,
      newLineSpacingFactor: 1,
      id: `norm_text_${line_i}`
    });

    // Position relative to reference lines (same logic as original)
    const refLineTop =
      shloka_config.reference_lines.top + line_i * shloka_config.reference_lines.spacing;

    const normY = refLineTop - (normResult.totalHeight + $SPACE_ABOVE_REFERENCE_LINE);
    const mainY =
      refLineTop -
      (mainResult.totalHeight +
        SPACE_BETWEEN_MAIN_AND_NORM +
        (normResult.totalHeight + $SPACE_ABOVE_REFERENCE_LINE));

    // Update y positions
    for (const cfg of normResult.configs) cfg.y = normY;
    for (const cfg of mainResult.configs) cfg.y = mainY;

    texts.push(...mainResult.configs);
    texts.push(...normResult.configs);

    // Number indicators (top-right; optional via show_image_on_top_right)
    if (
      show_shloka_number &&
      line_i === shloka_lines.length - 1 &&
      (shloka_data.shloka_num || $project_levels >= 3)
    ) {
      const number_main_text_raw = main_text.split(' ').at(-1)!;
      const number_main_text = number_main_text_raw.substring(1, number_main_text_raw.length - 1);

      const numMainResult = compute_fitted_text({
        text: number_main_text,
        fontFamily: mainFontFamily,
        fontStyle: 'bold',
        baseFontSize: 42,
        fontScale: main_text_font_info.size * 0.8,
        color: colors.number,
        left: shloka_config.bounding_coords.left,
        right: shloka_config.bounding_coords.right,
        top: shloka_config.bounding_coords.top + 8,
        bottom: shloka_config.bounding_coords.bottom,
        widthUsageFactor: 0.985,
        align: 'right',
        multiLine: false,
        newLineSpacingFactor: 1,
        id: 'num_main'
      });
      texts.push(...numMainResult.configs);

      const normNumText = norm_text.split(' ').at(-1)!;
      const numNormResult = compute_fitted_text({
        text: normNumText,
        fontFamily: robotoFamily,
        fontStyle: 'bold',
        baseFontSize: 28,
        fontScale: norm_text_font_info.size * 0.98,
        color: colors.number,
        left: shloka_config.bounding_coords.left,
        right: shloka_config.bounding_coords.right,
        top: 0, // will be positioned after
        bottom: shloka_config.bounding_coords.bottom,
        widthUsageFactor: 0.985,
        align: 'right',
        multiLine: false,
        newLineSpacingFactor: 1,
        id: 'num_norm'
      });
      // Position: below main number indicator
      const numMainY = numMainResult.configs[0]?.y ?? shloka_config.bounding_coords.top + 8;
      for (const cfg of numNormResult.configs) {
        cfg.y = numMainY + 5 + numMainResult.totalHeight;
      }
      texts.push(...numNormResult.configs);
    }
  }

  // --- Translation text ---
  const trans_query = {
    data: queryClient.getQueryData(
      image_trans_data_q_options(
        $image_selected_levels,
        get(image_lang_store),
        project,
        $text_data_present
      ).queryKey
    ) as Map<number, string> | undefined
  };
  const trans_text_data = use_editable
    ? get(image_trans_text)
    : (trans_query.data?.get(shloka_val) ?? '');
  if (trans_text_data) {
    const transResult = compute_wrapped_text({
      text: trans_text_data,
      fontFamily: transFontFamily,
      fontStyle: 'normal',
      baseFontSize: shloka_config.trans_text_font_size,
      fontScale: trans_text_font_info.size,
      color: colors.translation,
      ...$translation_bounding_coords,
      widthUsageFactor: 0.985,
      align: 'right',
      lineHeight: 1 + trans_text_font_info.new_line_spacing,
      id: 'trans'
    });
    texts.push(...transResult.configs);
  }

  // --- Lines ---
  const { bounding_lines, reference_lines } = compute_lines(
    shloka_config,
    shloka_type,
    $translation_bounding_coords
  );

  return { texts, bounding_lines, reference_lines, shloka_config, shloka_type };
};
