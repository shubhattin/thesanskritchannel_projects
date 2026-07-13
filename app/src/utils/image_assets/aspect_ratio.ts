/** Reduce width/height to a simple aspect ratio string (e.g. 3:2). Returns null for 1:1. */
export const get_non_square_aspect_ratio_label = (width: number, height: number): string | null => {
  if (!width || !height || width === height) return null;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
};
