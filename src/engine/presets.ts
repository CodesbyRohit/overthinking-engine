export interface Preset {
  id: string;
  label: string;
  emoji: string;
  dilemma: string;
  alternatives?: string[];
}

export const PRESETS: Preset[] = [
  { id: 'snack', label: 'Snack crisis', emoji: '🥟', dilemma: 'Should I order samosa or vada pav?' },
  { id: 'tabs', label: 'Browser tabs', emoji: '🗂️', dilemma: 'Should I close all 47 browser tabs or keep them open?' },
  {
    id: 'outfit',
    label: 'Outfit summit',
    emoji: '👕',
    dilemma: 'Should I wear the black hoodie, the blue kurta or the neon shirt?',
  },
  { id: 'message', label: 'Send the text?', emoji: '📱', dilemma: 'Should I send the long text message to my ex?' },
  { id: 'chai', label: 'Caffeine policy', emoji: '☕', dilemma: 'Cutting chai or cold coffee?' },
  {
    id: 'commute',
    label: 'Commute',
    emoji: '🚆',
    dilemma: 'How do I get to Bandra?',
    alternatives: ['Take the local train', 'Book an Uber', 'Walk and suffer'],
  },
];

export const DEMO_PRESET = PRESETS[0];
