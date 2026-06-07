/**
 * `@[youtube](…)` / `@[vimeo](…)` expansion for the custom unified markdown pipeline
 * (`renderLekhaMarkdownToHtml`). Pairs with `video/lekhaVideoToolbarPlugin` and `video-container.css`.
 */

/** Defaults: `.markdown-body .video-container` in `video-container.css`. */
const CARTA_VIDEO_DEFAULTS = {
  width: 640,
  height: 360,
  align: 'center' as const,
  allowFullscreen: true,
  noCookie: false
} as const;

/**
 * Expands `@[youtube](id-or-url)` / `@[vimeo](id-or-url)` to raw HTML for remark.
 * Skips fenced code blocks (```) so examples in code are left intact.
 */
export function expandCartaStyleVideoEmbedsInMarkdown(markdown: string) {
  const lines = markdown.split('\n');
  let in_fence = false;
  const youtube_re = /@\[youtube\]\(([^)]+)\)/g;
  const vimeo_re = /@\[vimeo\]\(([^)]+)\)/g;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i] ?? '')) {
      in_fence = !in_fence;
      continue;
    }
    if (in_fence) continue;
    lines[i] = (lines[i] ?? '')
      .replace(youtube_re, (_, raw: string) => `\n\n${buildCartaStyleYoutubeBlock(raw)}\n\n`)
      .replace(vimeo_re, (_, raw: string) => `\n\n${buildCartaStyleVimeoBlock(raw)}\n\n`);
  }
  return lines.join('\n');
}

function getSearchParamsMap(url: string) {
  const params = new Map<string, string>();
  try {
    if (!/^(https?:)\/\//.test(url)) return params;
    for (const [k, v] of new URL(url).searchParams) {
      params.set(k, v);
    }
  } catch {
    // ignore
  }
  return params;
}

function getYoutubeVideoId(video_id_or_url: string) {
  const re = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const m = video_id_or_url.match(re);
  return m && m[7] && m[7].length === 11 ? m[7] : video_id_or_url;
}

function getVimeoId(video_id_or_url: string) {
  const re =
    /(?:https?:)?\/\/(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/[^/]*\/videos\/|album\/\d+\/video\/|video\/|)(\d+)/;
  const m = video_id_or_url.match(re);
  return m && typeof m[1] === 'string' ? m[1] : video_id_or_url;
}

function buildCartaStyleYoutubeBlock(video_id_or_url: string) {
  const o = CARTA_VIDEO_DEFAULTS;
  const video_id = getYoutubeVideoId(video_id_or_url.trim());
  const parameters = getSearchParamsMap(video_id_or_url);
  const t = parameters.get('t');
  if (t !== undefined) {
    let m = t.match(/^(?:(\d+)m)?(\d+)s$/);
    if (m) {
      const minutes = m[1] ? parseInt(m[1], 10) : 0;
      const seconds = parseInt(m[2] ?? '0', 10);
      parameters.set('start', String(minutes * 60 + seconds));
    } else {
      m = t.match(/^(\d+)$/);
      if (m) parameters.set('start', m[1] ?? '');
    }
  }
  parameters.delete('t');
  parameters.delete('v');
  parameters.delete('feature');
  parameters.delete('origin');
  const q = new URLSearchParams();
  for (const [k, v] of parameters) q.set(k, v);
  const host = o.noCookie ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
  const src = `${host}/embed/${video_id}${q.toString() ? `?${q.toString()}` : ''}`;
  return wrapVideoIframeBlock(src, o);
}

function buildCartaStyleVimeoBlock(video_id_or_url: string) {
  const o = CARTA_VIDEO_DEFAULTS;
  const video_id = getVimeoId(video_id_or_url.trim());
  const src = `https://player.vimeo.com/video/${video_id}`;
  return wrapVideoIframeBlock(src, o);
}

function wrapVideoIframeBlock(
  src: string,
  o: { width: number; height: number; align: string; allowFullscreen: boolean }
) {
  const allow = [
    'accelerometer',
    'autoplay',
    'clipboard-write',
    'encrypted-media',
    'gyroscope',
    'picture-in-picture'
  ].join('; ');
  const full = o.allowFullscreen ? ' allowfullscreen' : '';
  return `<div class="video-container ${o.align}"><iframe src="${src}" width="${o.width}" height="${o.height}"${full} frameborder="0" allow="${allow}"></iframe></div>`;
}
