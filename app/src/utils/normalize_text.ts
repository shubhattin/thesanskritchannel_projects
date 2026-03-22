export const VEDIC_SVARAS = ['॒', '॑', '᳚', '᳛'] as const;

/**
 * Acts as a sanitization function to remove the vedic svara chihna for `search_text` column
 */
export const remove_vedic_svara_chihnAni = (text: string) => {
  return text.replace(new RegExp(`[${VEDIC_SVARAS.join('')}]`, 'g'), '');
};
