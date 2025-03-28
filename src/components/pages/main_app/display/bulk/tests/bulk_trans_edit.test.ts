import { describe, expect, it } from 'vitest';
import { text_to_trans_map, trans_map_to_text, NON_EXIST_INDICATOR } from '../trans_bulk_funcs';

const text = `0. Shloka Starts


1. Shloka 1
Contents of Shloka 1
Good Text


2. Shloka 2
Contents of Shloka 2


3. Shloka 3
Contents of Shloka 3


4. Shloka 4
Contents of Shloka 4


5. Shloka 5
Contents of Shloka 5


6. Shloka 6
Contents of Shloka 6


7. Shloka 7
Contents of Shloka 7


8. Shloka 8
Contents of Shloka 8


9. Shloka 9
Contents of Shloka 9


10. Shloka 10
Contents of Shloka 10


11. Shloka 11
Contents of Shloka 11


12. Shloka 12
Contents of Shloka 12


13. Shloka 13
Contents of Shloka 13


14. Shloka 14
Contents of Shloka 14


15. Shloka 15
Contents of Shloka 15


16. Shloka 16
Contents of Shloka 16


17. ${NON_EXIST_INDICATOR}


18. Shloka Ends`;

const map = new Map<number, string>();
map.set(0, 'Shloka Starts');
map.set(1, 'Shloka 1\nContents of Shloka 1\nGood Text');
map.set(2, 'Shloka 2\nContents of Shloka 2');
map.set(3, 'Shloka 3\nContents of Shloka 3');
map.set(4, 'Shloka 4\nContents of Shloka 4');
map.set(5, 'Shloka 5\nContents of Shloka 5');
map.set(6, 'Shloka 6\nContents of Shloka 6');
map.set(7, 'Shloka 7\nContents of Shloka 7');
map.set(8, 'Shloka 8\nContents of Shloka 8');
map.set(9, 'Shloka 9\nContents of Shloka 9');
map.set(10, 'Shloka 10\nContents of Shloka 10');
map.set(11, 'Shloka 11\nContents of Shloka 11');
map.set(12, 'Shloka 12\nContents of Shloka 12');
map.set(13, 'Shloka 13\nContents of Shloka 13');
map.set(14, 'Shloka 14\nContents of Shloka 14');
map.set(15, 'Shloka 15\nContents of Shloka 15');
map.set(16, 'Shloka 16\nContents of Shloka 16');
// map.set(17, 'Missing');
map.set(18, 'Shloka Ends');

const text1 = `0. Shloka Starts


1. Shloka 1
Contents of Shloka 1
Good Text


2. Shloka 2
Contents of Shloka 2


3: Shloka 3
Contents of Shloka 3


4. Shloka 4
Contents of Shloka 4


5. Shloka 5
Contents of Shloka 5


6. Shloka 6
Contents of Shloka 6


7. Shloka 7
Contents of Shloka 7


8. Shloka 8
Contents of Shloka 8


9. Shloka 9
Contents of Shloka 9


10. Shloka 10
Contents of Shloka 10


11. Shloka 11
Contents of Shloka 11


12. Shloka 12
Contents of Shloka 12


13. Shloka 13
Contents of Shloka 13


14. Shloka 14
Contents of Shloka 14


15. Shloka 15
Contents of Shloka 15


16. Shloka 16
Contents of Shloka 16


17. ----


18. Shloka Ends`;

describe('Testing Bulk Edit Translations', () => {
  it('Translation Map to Text', async () => {
    expect(trans_map_to_text(map, 18)).toBe(text);
  });
  it('Text to Translation Map', async () => {
    const out_map = text_to_trans_map(text1, 18);
    map.forEach((value, i) => expect(value).toBe(out_map.get(i)));
  });
});
