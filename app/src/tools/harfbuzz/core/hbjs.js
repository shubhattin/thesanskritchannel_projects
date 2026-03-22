import { load_hbjs } from './load_hbjs';

/**
 * @type {Record<string, Uint8Array>}
 */
const FONT_CACHE = {};

const load_font_from_url = async (font_url) => {
  if (FONT_CACHE[font_url]) return FONT_CACHE[font_url];
  const blob = new Uint8Array(await fetch(font_url).then((res) => res.arrayBuffer()));
  FONT_CACHE[font_url] = blob;
  return blob;
};
export const preload_font_from_url = load_font_from_url;

export const preload_harfbuzzjs_wasm = async () => {
  await load_hbjs();
};

/**
 * Generates an SVG path for the given text using the specified font.
 *
 * @param {string} text - The text to convert to an SVG path.
 * @param {string|Uint8Array} font - The font to use, either as a URL string or a Uint8Array.
 * @returns {Promise<string>} - A promise that resolves to the SVG path string.
 */
export async function get_text_svg_path(text, font) {
  const hb = await load_hbjs();
  let fontBlob = font instanceof Uint8Array ? font : await preload_font_from_url(font);
  var blob = hb.createBlob(fontBlob);
  var face = hb.createFace(blob, 0);
  var font = hb.createFont(face);
  font.setScale(1000, 1000); // Optional, if not given will be in font upem

  var buffer = hb.createBuffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  // buffer.setDirection('ltr'); // optional as can be by guessSegmentProperties also
  hb.shape(font, buffer); // features are not supported yet
  var result = buffer.json(font);

  // returns glyphs paths, totally optional
  var glyphs = {};
  result.forEach(function (x) {
    if (glyphs[x.g]) return;
    glyphs[x.g] = font.glyphToJson(x.g);
  });

  buffer.destroy();
  font.destroy();
  face.destroy();
  blob.destroy();

  var xmin = 10000;
  var xmax = -10000;
  var ymin = 10000;
  var ymax = -10000;
  var ax = 0;
  var ay = 0;
  var path = pathToRelative(
    result
      .map(function (x) {
        var result = glyphs[x.g]
          .filter(function (command) {
            return command.type !== 'Z';
          })
          .map(function (command) {
            var result = command.values
              .map(function (p, i) {
                // apply ax/ay/dx/dy to coords
                return i % 2 ? -(p + ay + x.dy) : p + ax + x.dx;
              })
              .map(function (x, i) {
                // bbox calc
                if (i % 2) {
                  if (x < ymin) ymin = x;
                  if (x > ymax) ymax = x;
                } else {
                  if (x < xmin) xmin = x;
                  if (x > xmax) xmax = x;
                }
                return x;
              });
            return [command.type].concat(result);
          });
        ax += x.ax;
        ay += x.ay;
        return result;
      })
      .reduce((acc, val) => acc.concat(val), [])
  )
    .map((x) => x[0] + x.slice(1).join(' '))
    .join('')
    .replace(/ -/g, '-');
  var width = xmax - xmin;
  var height = ymax - ymin;
  // pad it a bit
  var pad = Math.round(Math.min(width / 10, height / 10));
  xmin -= pad;
  ymin -= pad;
  width += pad * 2;
  height += pad * 2;

  var bbox = xmin + ' ' + ymin + ' ' + width + ' ' + height;

  return path;
}

// Totally optional, https://github.com/adobe-webplatform/Snap.svg/blob/7abe4d1/src/path.js#L532
function pathToRelative(pathArray) {
  if (!pathArray.length) return [];
  var x = pathArray[0][1],
    y = pathArray[0][2];
  var prevCmd = '';
  return [['M', x, y]].concat(
    pathArray.slice(1).map(function (pa) {
      var r = [prevCmd === pa[0] ? ' ' : pa[0].toLowerCase()].concat(
        pa.slice(1).map(function (z, i) {
          return z - (i % 2 ? y : x);
        })
      );
      var lastPoint = r.slice(-2);
      x += lastPoint[0];
      y += lastPoint[1];
      prevCmd = pa[0];
      return r;
    })
  );
}
