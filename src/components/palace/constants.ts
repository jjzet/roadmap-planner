import type { PalaceObjectIcon, PalaceTheme } from '@/types';

export const PALACE_ICONS: PalaceObjectIcon[] = [
  'chest', 'book', 'scroll', 'crystal', 'key', 'tree', 'sign',
  'lantern', 'npc', 'gem', 'potion', 'sword', 'shield', 'star', 'heart',
];

export const PALACE_OBJECT_COLORS = [
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#EF4444', // red
  '#F97316', // orange
];

export const PALACE_THEMES: PalaceTheme[] = [
  'overworld', 'dungeon', 'castle', 'forest', 'beach', 'lab',
];

const THEME_LABELS: Record<PalaceTheme, string> = {
  overworld: 'Overworld',
  dungeon:   'Dungeon',
  castle:    'Castle',
  forest:    'Forest',
  beach:     'Beach',
  lab:       'Lab',
};

export function themeLabel(t: PalaceTheme): string {
  return THEME_LABELS[t];
}
