/** Parse CSS color to #rrggbb for native color inputs. */
export function colorToHex(color: string): string {
  const trimmed = color?.trim();
  if (!trimmed) return '#000000';

  if (/^#[0-9A-Fa-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  const hsla_match = trimmed.match(/hsla?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%/);
  if (hsla_match) {
    const h = Number(hsla_match[1]) / 360;
    const s = Number(hsla_match[2]) / 100;
    const l = Number(hsla_match[3]) / 100;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r: number;
    let g: number;
    let b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    const to_hex = (n: number) =>
      Math.round(n * 255)
        .toString(16)
        .padStart(2, '0');
    return `#${to_hex(r)}${to_hex(g)}${to_hex(b)}`;
  }

  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.style.color = trimmed;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);
    const rgb_match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb_match) {
      const to_hex = (n: string) => Number(n).toString(16).padStart(2, '0');
      return `#${to_hex(rgb_match[1])}${to_hex(rgb_match[2])}${to_hex(rgb_match[3])}`;
    }
  }

  return '#000000';
}
