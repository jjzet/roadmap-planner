// 8×8 top-down hero — the avatar shown when walking a palace.
// Kept separate from PixelSprite so it isn't selectable as a memory icon.
// Pixel grid uses the same crispEdges SVG approach for pixel-aligned rendering.

interface HeroSpriteProps {
  size?: number;     // CSS pixels — total render size
  accent?: string;   // body / tunic accent (defaults to cyan, matches recent UI direction)
}

const PIXELS = [
  '..####..',
  '.#HHHH#.',
  '.#SSSS#.',
  '.#SEES#.',
  '.######.',
  '##OOOO##',
  '.#OOOO#.',
  '.##..##.',
];

export function HeroSprite({ size = 24, accent = '#06B6D4' }: HeroSpriteProps) {
  const palette: Record<string, string> = {
    '#': '#1f2937',  // outline
    H: '#7C2D12',    // hair (dark warm brown)
    S: '#FCD9A6',    // skin
    E: '#1f2937',    // eyes
    O: accent,       // tunic / body accent
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated', display: 'block' }}
    >
      {PIXELS.map((row, y) =>
        row.split('').map((ch, x) => {
          if (ch === '.') return null;
          const fill = palette[ch];
          if (!fill) return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
        }),
      )}
    </svg>
  );
}
