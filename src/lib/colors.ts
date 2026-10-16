/**
 * Categorical palette for alternatives (validated reference palette, light mode).
 * Colour follows the entity: an alternative keeps its colour everywhere, assigned
 * by its position in the normalized decision, never by its rank.
 */
export const ALT_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'] as const;

export function altColor(index: number): string {
  return ALT_COLORS[index % ALT_COLORS.length];
}

export const CHART = {
  surface: '#fcfcfb',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#6b6963',
  ink: '#0b0b0b',
};
