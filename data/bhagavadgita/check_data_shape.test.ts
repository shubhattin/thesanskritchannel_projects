import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import { z } from 'zod';

describe('Checking correct shape of shloka data', () => {
  for (let i = 1; i <= 18; i++) {
    it(`Checking data for chapter ${i}`, () => {
      const data = JSON.parse(fs.readFileSync(`./data/gita/data/${i}.json`, 'utf-8'));
      z.object({
        text: z.string(),
        index: z.number().int(),
        shloka_num: z.number().int().nullable()
      })
        .array()
        .parse(data);
    });
  }
});
