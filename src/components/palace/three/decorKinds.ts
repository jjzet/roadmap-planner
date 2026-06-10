// The placeable decoration palette. Kept separate from the meshes so
// non-3D code (and fast refresh) can use the metadata without three.js.

export interface DecorKind {
  id: string;
  label: string;
  swatch: string;   // palette chip colour in the HUD
  light?: boolean;  // emits a real point light (budgeted by the scene)
}

export const DECOR_KINDS: DecorKind[] = [
  { id: 'torch',     label: 'Torch',     swatch: '#ff9d45', light: true },
  { id: 'lamp',      label: 'Lamp',      swatch: '#ffe08a', light: true },
  { id: 'banner',    label: 'Banner',    swatch: '#c0392b' },
  { id: 'statue',    label: 'Statue',    swatch: '#9aa3ad' },
  { id: 'tree',      label: 'Tree',      swatch: '#3f8f4f' },
  { id: 'shrub',     label: 'Shrub',     swatch: '#6fae54' },
  { id: 'rock',      label: 'Rock',      swatch: '#8d8d94' },
  { id: 'crate',     label: 'Crate',     swatch: '#a9743e' },
  { id: 'barrel',    label: 'Barrel',    swatch: '#7c5a32' },
  { id: 'bookshelf', label: 'Bookshelf', swatch: '#6b4a2c' },
  { id: 'rug',       label: 'Rug',       swatch: '#b03a5b' },
  { id: 'fence',     label: 'Fence',     swatch: '#a08a64' },
];

export function decorEmitsLight(kind: string): boolean {
  return DECOR_KINDS.find((k) => k.id === kind)?.light ?? false;
}
