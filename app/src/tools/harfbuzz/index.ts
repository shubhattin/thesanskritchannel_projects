import load_hdjs_worker from './worker?worker';
import type { Arg, ArgUUID } from './types';
import type * as functions from './core/hbjs';

const hbjs_worker = new load_hdjs_worker();

// uuid: [func_name, callback]
const messages_queue: Record<string, [string, (response: any) => void]> = {};

hbjs_worker.onmessage = (event) => {
  const data = event.data;
  if (data.uuid in messages_queue) {
    const [func_name, resolve] = messages_queue[data.uuid];
    if (data.func_name === func_name) {
      resolve(data?.response);
      delete messages_queue[data.uuid];
    }
  }
};

async function postMessage<F extends keyof typeof functions>(message: Arg<F>) {
  return new Promise<ReturnType<(typeof functions)[F]>>((resolve, reject) => {
    const uuid = crypto.randomUUID();
    const post_message: ArgUUID<F> = {
      ...message,
      uuid
    };
    messages_queue[uuid] = [message.func_name, resolve];
    hbjs_worker.postMessage(post_message);
  });
}

/**
 * Generates an SVG path for the given text using the specified font.
 *
 * @param {string} text - The text to convert to an SVG path.
 * @param {string|Uint8Array} font - The font to use, either as a URL string or a Uint8Array.
 * @returns {Promise<string>} - A promise that resolves to the SVG path string.
 */
export async function get_text_svg_path(text: string, font: string | Uint8Array) {
  return await postMessage({
    func_name: 'get_text_svg_path',
    args: [text, font]
  });
}

export async function preload_harfbuzzjs_wasm() {
  return await postMessage({
    func_name: 'preload_harfbuzzjs_wasm',
    args: []
  });
}

export async function preload_font_from_url(url: string) {
  return await postMessage({
    func_name: 'preload_font_from_url',
    args: [url]
  });
}
