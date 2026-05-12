import { useMemo } from 'react';
import type { MemoryPalaceData, PalaceObject, PalaceTheme } from '@/types';
import { PixelSprite } from './PixelSprite';

const TILE = 24; // px per tile — rendered map cell size

// Per-theme floor + accent. Two-tone checkerboard makes it read as a tiled
// 8-bit overworld without sprite art.
const THEMES: Record<PalaceTheme, { a: string; b: string; border: string; label: string }> = {
  overworld: { a: '#86C36A', b: '#74B556', border: '#3F6E2A', label: 'Overworld' },
  dungeon:   { a: '#3F3F46', b: '#52525B', border: '#18181B', label: 'Dungeon' },
  castle:    { a: '#D6D3D1', b: '#A8A29E', border: '#44403C', label: 'Castle' },
  forest:    { a: '#166534', b: '#15803D', border: '#052e16', label: 'Forest' },
  beach:     { a: '#FDE68A', b: '#FCD34D', border: '#92400E', label: 'Beach' },
  lab:       { a: '#E0F2FE', b: '#BAE6FD', border: '#075985', label: 'Lab' },
};

interface PalaceMapProps {
  data: MemoryPalaceData;
  theme: PalaceTheme;
  selectedObjectId: string | null;
  onSelectObject: (id: string | null) => void;
  onTileClick?: (x: number, y: number) => void;
}

export function PalaceMap({ data, theme, selectedObjectId, onSelectObject, onTileClick }: PalaceMapProps) {
  const palette = THEMES[theme];
  const widthPx = data.width * TILE;
  const heightPx = data.height * TILE;

  const tiles = useMemo(() => {
    const out: Array<{ x: number; y: number; fill: string }> = [];
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        out.push({ x, y, fill: (x + y) % 2 === 0 ? palette.a : palette.b });
      }
    }
    return out;
  }, [data.width, data.height, palette.a, palette.b]);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onTileClick) return;
    const target = e.target as SVGElement;
    if (target.dataset?.role === 'object') return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * widthPx;
    const py = ((e.clientY - rect.top) / rect.height) * heightPx;
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= data.width || ty >= data.height) return;
    onTileClick(tx, ty);
  };

  return (
    <div
      className="inline-block border-4 rounded-sm shadow-lg"
      style={{
        borderColor: palette.border,
        backgroundColor: palette.a,
        boxShadow:
          'inset 0 0 0 1px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      <svg
        width={widthPx}
        height={heightPx}
        viewBox={`0 0 ${widthPx} ${heightPx}`}
        shapeRendering="crispEdges"
        style={{ imageRendering: 'pixelated', display: 'block' }}
        onClick={handleSvgClick}
      >
        {/* Tiled floor */}
        {tiles.map((t) => (
          <rect
            key={`${t.x}-${t.y}`}
            x={t.x * TILE}
            y={t.y * TILE}
            width={TILE}
            height={TILE}
            fill={t.fill}
          />
        ))}

        {/* Rooms — translucent floor tint + 2px walls */}
        {data.rooms.map((r) => (
          <g key={r.id}>
            <rect
              x={r.x * TILE}
              y={r.y * TILE}
              width={r.width * TILE}
              height={r.height * TILE}
              fill={r.color}
              opacity={0.42}
            />
            <rect
              x={r.x * TILE}
              y={r.y * TILE}
              width={r.width * TILE}
              height={r.height * TILE}
              fill="none"
              stroke={r.color}
              strokeWidth={3}
              opacity={0.95}
            />
            <foreignObject
              x={r.x * TILE + 2}
              y={r.y * TILE + 2}
              width={r.width * TILE - 4}
              height={14}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono Variable', monospace",
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#1f2937',
                  background: 'rgba(255,255,255,0.7)',
                  display: 'inline-block',
                  padding: '0 4px',
                  borderRadius: 2,
                  fontWeight: 600,
                }}
              >
                {r.name}
              </div>
            </foreignObject>
          </g>
        ))}

        {/* Objects */}
        {data.objects.map((o) => (
          <ObjectMarker
            key={o.id}
            obj={o}
            tile={TILE}
            selected={o.id === selectedObjectId}
            onSelect={() => onSelectObject(o.id === selectedObjectId ? null : o.id)}
          />
        ))}
      </svg>
    </div>
  );
}

interface ObjectMarkerProps {
  obj: PalaceObject;
  tile: number;
  selected: boolean;
  onSelect: () => void;
}

function ObjectMarker({ obj, tile, selected, onSelect }: ObjectMarkerProps) {
  return (
    <g
      data-role="object"
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {selected && (
        <rect
          x={obj.x * tile - 2}
          y={obj.y * tile - 2}
          width={tile + 4}
          height={tile + 4}
          fill="none"
          stroke="#06B6D4"
          strokeWidth={2}
        />
      )}
      <foreignObject x={obj.x * tile} y={obj.y * tile} width={tile} height={tile}>
        <div data-role="object" style={{ width: tile, height: tile }}>
          <PixelSprite icon={obj.icon} color={obj.color} size={tile} />
        </div>
      </foreignObject>
    </g>
  );
}

