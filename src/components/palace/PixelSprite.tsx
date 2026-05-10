import type { PalaceObjectIcon } from '@/types';

// Pixel-art sprites — every glyph is an 8×8 grid of single-character cells.
// '.' = transparent. Other characters key into a sprite-specific palette
// generated from the object's accent colour, so the user's chosen colour
// flows through every sprite consistently.
//
// Rendering uses SVG <rect> with shape-rendering="crispEdges" — sharp at any
// scale, no font/glyph rendering quirks, and the same primitive that drives
// every other map element so they pixel-align cleanly.

type Palette = Record<string, string>;

interface SpriteDef {
  pixels: string[];      // exactly 8 strings of length 8
  palette: (accent: string) => Palette;
}

// Helpers ------------------------------------------------------------------

function darken(hex: string, amt: number): string {
  const m = hex.replace('#', '');
  const num = parseInt(m, 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - amt);
  const g = Math.max(0, ((num >> 8) & 0xff) - amt);
  const b = Math.max(0, (num & 0xff) - amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function lighten(hex: string, amt: number): string {
  const m = hex.replace('#', '');
  const num = parseInt(m, 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amt);
  const g = Math.min(255, ((num >> 8) & 0xff) + amt);
  const b = Math.min(255, (num & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Sprite library -----------------------------------------------------------

const SPRITES: Record<PalaceObjectIcon, SpriteDef> = {
  chest: {
    pixels: [
      '........',
      '.######.',
      '.#OOOO#.',
      '.#OYYO#.',
      '.######.',
      '.#OOOO#.',
      '.#OOOO#.',
      '.######.',
    ],
    palette: (a) => ({ '#': '#1f2937', O: a, Y: lighten(a, 80) }),
  },
  book: {
    pixels: [
      '........',
      '########',
      '#OOOOOO#',
      '#OWWWWO#',
      '#OWWWWO#',
      '#OOOOOO#',
      '#OOOOOO#',
      '########',
    ],
    palette: (a) => ({ '#': '#1f2937', O: a, W: lighten(a, 100) }),
  },
  scroll: {
    pixels: [
      '...##...',
      '..####..',
      '.#OOOO#.',
      '.#WWWW#.',
      '.#WWWW#.',
      '.#OOOO#.',
      '..####..',
      '...##...',
    ],
    palette: (a) => ({ '#': darken(a, 60), O: a, W: '#fef3c7' }),
  },
  crystal: {
    pixels: [
      '...##...',
      '..####..',
      '.#OOOO#.',
      '#OOWWOO#',
      '#OWWWWO#',
      '.#OWWO#.',
      '..#OO#..',
      '...##...',
    ],
    palette: (a) => ({ '#': darken(a, 70), O: a, W: lighten(a, 110) }),
  },
  key: {
    pixels: [
      '...####.',
      '..#OO#O#',
      '..#O#OO#',
      '..#OO##.',
      '..#OO#..',
      '.#OO#...',
      '#O##....',
      '##......',
    ],
    palette: (a) => ({ '#': darken(a, 60), O: a }),
  },
  tree: {
    pixels: [
      '..####..',
      '.######.',
      '########',
      '.######.',
      '..####..',
      '...##...',
      '...BB...',
      '...BB...',
    ],
    palette: (a) => ({ '#': a, B: '#5C2E10' }),
  },
  sign: {
    pixels: [
      '.######.',
      '#OOOOOO#',
      '#OWWWWO#',
      '#OWWWWO#',
      '#OOOOOO#',
      '.######.',
      '...BB...',
      '...BB...',
    ],
    palette: (a) => ({ '#': darken(a, 80), O: a, W: '#fef9c3', B: '#5C2E10' }),
  },
  lantern: {
    pixels: [
      '...##...',
      '..####..',
      '.#YYYY#.',
      '.#YOOY#.',
      '.#YOOY#.',
      '.#YYYY#.',
      '..####..',
      '...##...',
    ],
    palette: (a) => ({ '#': '#1f2937', Y: lighten(a, 90), O: a }),
  },
  npc: {
    pixels: [
      '..####..',
      '.#SSSS#.',
      '.#SOOS#.',
      '.#SSSS#.',
      '.######.',
      '#OOOOOO#',
      '#O####O#',
      '#O#..#O#',
    ],
    palette: (a) => ({ '#': darken(a, 70), O: a, S: '#fde68a' }),
  },
  gem: {
    pixels: [
      '........',
      '..####..',
      '.##WW##.',
      '#OOWWOO#',
      '.#OOOO#.',
      '..#OO#..',
      '...##...',
      '........',
    ],
    palette: (a) => ({ '#': darken(a, 70), O: a, W: lighten(a, 110) }),
  },
  potion: {
    pixels: [
      '..####..',
      '..#WW#..',
      '..#OO#..',
      '.######.',
      '#OOOOOO#',
      '#OWWWWO#',
      '#OOOOOO#',
      '.######.',
    ],
    palette: (a) => ({ '#': '#1f2937', O: a, W: lighten(a, 100) }),
  },
  sword: {
    pixels: [
      '....##..',
      '...##W#.',
      '..##W#..',
      '.##W#...',
      '##W#....',
      '#####...',
      '..##....',
      '..##....',
    ],
    palette: (a) => ({ '#': '#94a3b8', W: a }),
  },
  shield: {
    pixels: [
      '.######.',
      '#OOOOOO#',
      '#OWWWWO#',
      '#OWBBWO#',
      '#OWBBWO#',
      '#OWWWWO#',
      '.#OOOO#.',
      '..####..',
    ],
    palette: (a) => ({ '#': darken(a, 70), O: a, W: lighten(a, 80), B: darken(a, 40) }),
  },
  star: {
    pixels: [
      '...##...',
      '...##...',
      '########',
      '.######.',
      '.######.',
      '..####..',
      '.##..##.',
      '##....##',
    ],
    palette: (a) => ({ '#': a }),
  },
  heart: {
    pixels: [
      '.##..##.',
      '########',
      '########',
      '########',
      '.######.',
      '..####..',
      '...##...',
      '........',
    ],
    palette: (a) => ({ '#': a }),
  },
};

interface PixelSpriteProps {
  icon: PalaceObjectIcon;
  color: string;
  size?: number; // CSS pixels — total render size
  className?: string;
}

export function PixelSprite({ icon, color, size = 24, className }: PixelSpriteProps) {
  const def = SPRITES[icon] ?? SPRITES.chest;
  const palette = def.palette(color);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      className={className}
      style={{ imageRendering: 'pixelated', display: 'block' }}
    >
      {def.pixels.map((row, y) =>
        row.split('').map((ch, x) => {
          if (ch === '.') return null;
          const fill = palette[ch];
          if (!fill) return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
        })
      )}
    </svg>
  );
}

