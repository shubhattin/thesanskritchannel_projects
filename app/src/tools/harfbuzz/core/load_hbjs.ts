import * as hbjs_mod from './hbjs_core';

let hbjs: ReturnType<typeof hbjs_mod.hbjs> = null!;
export const load_hbjs = async () => {
  const url = new URL('/src/tools/harfbuzz/core/hb.wasm', import.meta.url).href;

  // write te above using async/await
  if (!hbjs) {
    const wasm = await fetch(url).then((x) => x.arrayBuffer());
    const result = await WebAssembly.instantiate(wasm);
    hbjs = hbjs_mod.hbjs(result.instance);
  }
  return hbjs;
};
