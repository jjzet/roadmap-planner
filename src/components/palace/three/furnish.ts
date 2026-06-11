// Kind-specific room furnishings — what makes a Library *look* like a
// library. Each room kind gets a small declarative spec: places along
// walls, in corners, or in the open floor, resolved here into world-space
// prop placements. Furniture is cosmetic (no collision) and skips spots
// already occupied by loci so pedestals always stay readable.

import type { PalaceObject, PalaceRoom } from '@/types';
import { THEME_ROOMS } from '../presets';
import { SCALE, tileCenter } from './world';

export interface FurnishItem {
  kind: string;     // DecorMesh kind (palette props + fixtures)
  x: number;        // world coords
  z: number;
  rot: number;
  scale: number;
}

type Side = 'n' | 's' | 'w' | 'e';

// Fractions along a wall for N items, leaving the centred doorway clear.
const FRACS: Record<number, number[]> = {
  1: [0.26],
  2: [0.24, 0.76],
  3: [0.16, 0.32, 0.68],
  4: [0.15, 0.32, 0.68, 0.85],
};

const WALL_INSET = 0.78;
const CORNER_INSET = 1.0;

function along(room: PalaceRoom, side: Side, kind: string, count: number): FurnishItem[] {
  const x0 = room.x * SCALE;
  const z0 = room.y * SCALE;
  const w = room.width * SCALE;
  const h = room.height * SCALE;
  return (FRACS[count] ?? FRACS[2]).map((f) => {
    switch (side) {
      case 'n': return { kind, x: x0 + f * w, z: z0 + WALL_INSET, rot: 0, scale: 1 };
      case 's': return { kind, x: x0 + f * w, z: z0 + h - WALL_INSET, rot: Math.PI, scale: 1 };
      case 'w': return { kind, x: x0 + WALL_INSET, z: z0 + f * h, rot: Math.PI / 2, scale: 1 };
      case 'e': return { kind, x: x0 + w - WALL_INSET, z: z0 + f * h, rot: -Math.PI / 2, scale: 1 };
    }
  });
}

function corner(room: PalaceRoom, which: 'ne' | 'nw' | 'se' | 'sw', kind: string): FurnishItem {
  const x0 = room.x * SCALE;
  const z0 = room.y * SCALE;
  const x1 = x0 + room.width * SCALE;
  const z1 = z0 + room.height * SCALE;
  const x = which.includes('w') ? x0 + CORNER_INSET : x1 - CORNER_INSET;
  const z = which.includes('n') ? z0 + CORNER_INSET : z1 - CORNER_INSET;
  return { kind, x, z, rot: 0, scale: 1 };
}

function corners(room: PalaceRoom, kind: string): FurnishItem[] {
  return (['ne', 'nw', 'se', 'sw'] as const).map((c) => corner(room, c, kind));
}

function at(room: PalaceRoom, fx: number, fz: number, kind: string, rot = 0, scale = 1): FurnishItem {
  return {
    kind,
    x: (room.x + fx * room.width) * SCALE,
    z: (room.y + fz * room.height) * SCALE,
    rot,
    scale,
  };
}

// Place tokens used by the spec table below.
type Place =
  | `${Side}${1 | 2 | 3 | 4}`     // along a wall, n items
  | 'corners' | 'cornerNE' | 'cornerNW' | 'cornerSE' | 'cornerSW'
  | 'center' | 'back' | 'front' | 'flankBack';

function resolve(room: PalaceRoom, place: Place, kind: string): FurnishItem[] {
  if (/^[nswe][1-4]$/.test(place)) {
    return along(room, place[0] as Side, kind, Number(place[1]));
  }
  switch (place) {
    case 'corners': return corners(room, kind);
    case 'cornerNE': return [corner(room, 'ne', kind)];
    case 'cornerNW': return [corner(room, 'nw', kind)];
    case 'cornerSE': return [corner(room, 'se', kind)];
    case 'cornerSW': return [corner(room, 'sw', kind)];
    case 'center': return [at(room, 0.5, 0.5, kind)];
    case 'back': return [at(room, 0.5, 0.3, kind)];
    case 'front': return [at(room, 0.5, 0.72, kind)];
    case 'flankBack': return [at(room, 0.3, 0.3, kind), at(room, 0.7, 0.3, kind)];
    default: return [];
  }
}

// One line per room kind. Keys are RoomKind ids from presets.ts.
const SPEC: Record<string, Array<[Place, string]>> = {
  // ── Beach ──
  'beach-hut':       [['back', 'table'], ['cornerSW', 'crate'], ['cornerNE', 'shrub']],
  'lifeguard-tower': [['back', 'dais'], ['cornerNE', 'lamp'], ['cornerNW', 'barrel']],
  'pier':            [['w2', 'fence'], ['e2', 'fence'], ['back', 'barrel']],
  'tide-pool':       [['center', 'fountain'], ['corners', 'rock']],
  'sand-castle':     [['back', 'dais'], ['flankBack', 'banner']],
  'cove':            [['cornerNW', 'rock'], ['cornerNE', 'rock'], ['back', 'crate']],
  'shipwreck':       [['back', 'rock'], ['w2', 'crate'], ['e2', 'barrel'], ['cornerSE', 'fence']],
  'boardwalk':       [['w2', 'lamp'], ['e2', 'fence'], ['back', 'table']],

  // ── Castle ──
  'throne-room':  [['back', 'dais'], ['flankBack', 'banner'], ['center', 'rug']],
  'armoury':      [['n2', 'weaponrack'], ['w2', 'weaponrack'], ['cornerSE', 'crate']],
  'dungeon-cell': [['w2', 'torch'], ['e2', 'torch'], ['cornerNW', 'barrel']],
  'grain-store':  [['n2', 'crate'], ['w2', 'barrel'], ['e2', 'barrel']],
  'kitchen':      [['back', 'hearth'], ['center', 'table'], ['cornerSE', 'barrel']],
  'library':      [['n4', 'bookshelf'], ['w2', 'bookshelf'], ['center', 'rug'], ['cornerSE', 'lamp']],
  'tower':        [['corners', 'torch'], ['center', 'dais']],
  'courtyard':    [['center', 'fountain'], ['corners', 'shrub']],
  'chapel':       [['back', 'dais'], ['flankBack', 'torch'], ['center', 'rug']],
  'stables':      [['n2', 'fence'], ['w2', 'crate'], ['cornerNE', 'barrel']],
  'war-room':     [['center', 'table'], ['flankBack', 'banner'], ['cornerNW', 'torch']],

  // ── Dungeon ──
  'crypt':            [['n2', 'statue'], ['flankBack', 'torch']],
  'treasure-vault':   [['n2', 'crate'], ['w2', 'crate'], ['e2', 'barrel'], ['back', 'dais']],
  'trap-room':        [['corners', 'rock']],
  'boss-chamber':     [['back', 'dais'], ['flankBack', 'torch'], ['corners', 'rock']],
  'cell-block':       [['w2', 'fence'], ['e2', 'fence'], ['cornerNW', 'torch']],
  'mushroom-cavern':  [['corners', 'mushroom'], ['back', 'mushroom'], ['center', 'bigcrystal']],
  'underground-lake': [['center', 'fountain'], ['cornerNW', 'rock'], ['cornerSE', 'rock'], ['back', 'bigcrystal']],

  // ── Forest ──
  'glade':         [['corners', 'shrub'], ['back', 'tree']],
  'hollow-tree':   [['back', 'tree'], ['flankBack', 'shrub']],
  'mushroom-ring': [['corners', 'mushroom'], ['center', 'mushroom']],
  'brook':         [['w2', 'rock'], ['e2', 'shrub'], ['center', 'fountain']],
  'cabin':         [['back', 'hearth'], ['center', 'table'], ['cornerSW', 'crate']],
  'ranger-camp':   [['center', 'campfire'], ['n2', 'crate'], ['cornerSE', 'fence']],
  'ancient-ruins': [['corners', 'statue'], ['n2', 'rock'], ['center', 'dais']],

  // ── Overworld ──
  'village-square': [['center', 'fountain'], ['corners', 'lamp']],
  'forest-path':    [['w2', 'tree'], ['e2', 'tree'], ['cornerNE', 'rock']],
  'bridge':         [['w2', 'fence'], ['e2', 'fence'], ['flankBack', 'lamp']],
  'crossroads':     [['center', 'lamp'], ['corners', 'rock']],
  'market':         [['n2', 'table'], ['w2', 'crate'], ['e2', 'barrel']],
  'inn':            [['back', 'hearth'], ['center', 'table'], ['w2', 'barrel'], ['cornerNE', 'lamp']],
  'farm':           [['n2', 'fence'], ['s2', 'fence'], ['cornerNW', 'crate'], ['back', 'table']],
  'harbor':         [['w2', 'barrel'], ['e2', 'crate'], ['back', 'lamp']],

  // ── Lab ──
  'lab-bench':     [['n2', 'table'], ['w2', 'table'], ['cornerSE', 'crate']],
  'specimen-room': [['n2', 'bookshelf'], ['w2', 'table']],
  'cold-storage':  [['n2', 'crate'], ['w2', 'crate'], ['center', 'bigcrystal']],
  'server-room':   [['n2', 'bookshelf'], ['w2', 'bookshelf'], ['e2', 'bookshelf']],
  'containment':   [['center', 'dais'], ['corners', 'lamp']],
  'observatory':   [['center', 'dais'], ['back', 'bigcrystal'], ['cornerNE', 'lamp']],
  'greenhouse':    [['n2', 'shrub'], ['w2', 'shrub'], ['e2', 'shrub'], ['center', 'fountain']],
};

// Rooms created before kinds were persisted (or via paths that dropped the
// field) can still furnish themselves: match the room's display name back to
// a known kind. "Kitchen" → kitchen, "War Room 2" → war-room.
const NAME_TO_KIND: Record<string, string> = Object.fromEntries(
  Object.values(THEME_ROOMS).flat().map((k) => [k.name.toLowerCase(), k.id]),
);

function inferKind(room: PalaceRoom): string | undefined {
  if (room.kind) return room.kind;
  const base = room.name.trim().toLowerCase().replace(/\s+\d+$/, '');
  return NAME_TO_KIND[base];
}

// Open-floor placements can land on a locus pedestal — drop those so the
// memory anchors always stay readable.
const LOCUS_CLEARANCE = 1.35;

export function furnishRoom(room: PalaceRoom, objects: PalaceObject[]): FurnishItem[] {
  const kind = inferKind(room);
  const spec = kind ? SPEC[kind] : undefined;
  if (!spec) return [];
  const loci = objects
    .filter((o) => o.roomId === room.id)
    .map((o) => tileCenter(o.x, o.y));
  return spec
    .flatMap(([place, kind]) => resolve(room, place, kind))
    .filter((f) => loci.every((p) => (p.x - f.x) ** 2 + (p.z - f.z) ** 2 > LOCUS_CLEARANCE ** 2));
}
