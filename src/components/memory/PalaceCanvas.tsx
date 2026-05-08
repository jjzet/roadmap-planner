import { useMemo, useRef, useState } from 'react';
import type { MemoryPalace, PalaceObject, PalaceRoom, PalaceTheme } from '@/types';

const TILE_SIZE = 32;

const THEME_PRESETS: Record<PalaceTheme, { ground: string; accent: string; border: string; label: string }> = {
  forest:  { ground: '#4f7d3a', accent: '#3d6a2a', border: '#2a4a1d', label: 'Forest' },
  dungeon: { ground: '#3a3744', accent: '#2a2832', border: '#1a181f', label: 'Dungeon' },
  castle:  { ground: '#5a5860', accent: '#4a484f', border: '#2a282c', label: 'Castle' },
  beach:   { ground: '#e8d49a', accent: '#cdb47a', border: '#a48d57', label: 'Beach' },
  space:   { ground: '#1b1b3a', accent: '#0c0c25', border: '#04041a', label: 'Space' },
};

function tileChecker(x: number, y: number, theme: PalaceTheme): string {
  const t = THEME_PRESETS[theme];
  return (x + y) % 2 === 0 ? t.ground : t.accent;
}

function starfield(x: number, y: number): boolean {
  return ((x * 31 + y * 17) % 23) === 0;
}

interface Props {
  palace: MemoryPalace;
  selectedObjectId: string | null;
  selectedRoomId: string | null;
  onSelectObject: (id: string | null) => void;
  onSelectRoom: (id: string | null) => void;
  onCanvasClick: (gridX: number, gridY: number) => void;
}

export function PalaceCanvas({
  palace,
  selectedObjectId,
  selectedRoomId,
  onSelectObject,
  onSelectRoom,
  onCanvasClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const themePreset = THEME_PRESETS[palace.theme];

  const objectMap = useMemo(() => {
    const map = new Map<string, PalaceObject>();
    palace.objects.forEach((o) => map.set(`${o.x},${o.y}`, o));
    return map;
  }, [palace.objects]);

  const roomAt = (x: number, y: number): PalaceRoom | null => {
    for (const r of palace.rooms) {
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
    }
    return null;
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const gx = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const gy = Math.floor((e.clientY - rect.top) / TILE_SIZE);
    if (gx < 0 || gy < 0 || gx >= palace.grid_width || gy >= palace.grid_height) return;

    const obj = objectMap.get(`${gx},${gy}`);
    if (obj) {
      onSelectObject(obj.id);
      return;
    }
    const room = roomAt(gx, gy);
    if (room) {
      onSelectRoom(room.id);
      onCanvasClick(gx, gy);
      return;
    }
    onSelectRoom(null);
    onSelectObject(null);
    onCanvasClick(gx, gy);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const gx = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const gy = Math.floor((e.clientY - rect.top) / TILE_SIZE);
    if (gx < 0 || gy < 0 || gx >= palace.grid_width || gy >= palace.grid_height) {
      setHover(null);
      return;
    }
    setHover({ x: gx, y: gy });
  };

  const width = palace.grid_width * TILE_SIZE;
  const height = palace.grid_height * TILE_SIZE;

  return (
    <div className="inline-block bg-gray-900 border-2 border-gray-700 rounded-sm shadow-lg p-2">
      <div
        ref={containerRef}
        className="relative cursor-crosshair"
        style={{
          width,
          height,
          imageRendering: 'pixelated',
          background: themePreset.border,
        }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Floor tiles — checker pattern */}
        <svg
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
        >
          {Array.from({ length: palace.grid_height }).map((_, y) =>
            Array.from({ length: palace.grid_width }).map((_, x) => (
              <rect
                key={`${x}-${y}`}
                x={x * TILE_SIZE}
                y={y * TILE_SIZE}
                width={TILE_SIZE}
                height={TILE_SIZE}
                fill={tileChecker(x, y, palace.theme)}
              />
            ))
          )}

          {/* Theme decoration: stars for space */}
          {palace.theme === 'space' &&
            Array.from({ length: palace.grid_height }).map((_, y) =>
              Array.from({ length: palace.grid_width }).map((_, x) =>
                starfield(x, y) ? (
                  <rect
                    key={`s-${x}-${y}`}
                    x={x * TILE_SIZE + TILE_SIZE / 2 - 1}
                    y={y * TILE_SIZE + TILE_SIZE / 2 - 1}
                    width={2}
                    height={2}
                    fill="#ffffff"
                    opacity={0.7}
                  />
                ) : null
              )
            )}

          {/* Rooms — colored floor + walls */}
          {palace.rooms.map((r) => {
            const isSelected = r.id === selectedRoomId;
            return (
              <g key={r.id}>
                <rect
                  x={r.x * TILE_SIZE}
                  y={r.y * TILE_SIZE}
                  width={r.w * TILE_SIZE}
                  height={r.h * TILE_SIZE}
                  fill={r.color}
                  opacity={0.85}
                />
                {/* outer wall — pixel-art double border */}
                <rect
                  x={r.x * TILE_SIZE}
                  y={r.y * TILE_SIZE}
                  width={r.w * TILE_SIZE}
                  height={r.h * TILE_SIZE}
                  fill="none"
                  stroke={isSelected ? '#06B6D4' : '#0e0e1a'}
                  strokeWidth={isSelected ? 4 : 3}
                />
                <rect
                  x={r.x * TILE_SIZE + 3}
                  y={r.y * TILE_SIZE + 3}
                  width={r.w * TILE_SIZE - 6}
                  height={r.h * TILE_SIZE - 6}
                  fill="none"
                  stroke={isSelected ? 'rgba(6,182,212,0.6)' : 'rgba(255,255,255,0.18)'}
                  strokeWidth={1}
                />
              </g>
            );
          })}
        </svg>

        {/* Room labels */}
        {palace.rooms.map((r) => (
          <div
            key={`label-${r.id}`}
            className="absolute pointer-events-none font-mono uppercase tracking-wider text-[9px] font-bold text-white"
            style={{
              left: r.x * TILE_SIZE + 4,
              top: r.y * TILE_SIZE + 4,
              textShadow: '1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000',
            }}
          >
            {r.name}
          </div>
        ))}

        {/* Objects — emoji sprites */}
        {palace.objects.map((o) => {
          const isSelected = o.id === selectedObjectId;
          return (
            <div
              key={o.id}
              className="absolute flex items-center justify-center select-none transition-transform"
              style={{
                left: o.x * TILE_SIZE,
                top: o.y * TILE_SIZE,
                width: TILE_SIZE,
                height: TILE_SIZE,
                fontSize: TILE_SIZE - 8,
                lineHeight: 1,
                filter: isSelected
                  ? 'drop-shadow(0 0 4px #06B6D4) drop-shadow(0 0 8px #06B6D4)'
                  : 'drop-shadow(1px 2px 0 rgba(0,0,0,0.6))',
                transform: isSelected ? 'scale(1.15)' : undefined,
                cursor: 'pointer',
              }}
              title={o.label || 'object'}
            >
              {o.sprite}
            </div>
          );
        })}

        {/* Hover tile highlight */}
        {hover && (
          <div
            className="absolute pointer-events-none border border-cyan-300/80"
            style={{
              left: hover.x * TILE_SIZE,
              top: hover.y * TILE_SIZE,
              width: TILE_SIZE,
              height: TILE_SIZE,
              boxShadow: 'inset 0 0 0 2px rgba(6,182,212,0.35)',
            }}
          />
        )}
      </div>

      {/* Coord readout */}
      <div className="flex items-center justify-between px-1 pt-1.5 text-[9px] font-mono uppercase tracking-wider text-gray-400">
        <span>
          {themePreset.label} · {palace.grid_width}×{palace.grid_height}
        </span>
        <span>
          {hover ? `x ${hover.x}, y ${hover.y}` : `${palace.objects.length} objects · ${palace.rooms.length} rooms`}
        </span>
      </div>
    </div>
  );
}
