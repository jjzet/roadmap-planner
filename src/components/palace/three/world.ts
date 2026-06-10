// 3D world generation for walkable palaces.
//
// The 2D palace data stays the single source of truth — this module is a
// renderer-side projection of it. Tiles map to world units via SCALE, rooms
// extrude into walled chambers with a doorway centred on each side, and the
// whole map is ringed by a perimeter wall so the player can't fall off the
// edge of the world.

import type { MemoryPalaceData, PalaceRoom, PalaceTheme } from '@/types';

export const SCALE = 2;          // world units per tile
export const WALL_HEIGHT = 3;
export const WALL_THICKNESS = 0.34;
export const DOOR_WIDTH = 2.6;
export const EYE_HEIGHT = 1.65;
export const PLAYER_RADIUS = 0.45;

export interface WallBox {
  // Axis-aligned box in world coords (y from 0 to height).
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  height: number;
}

export interface Theme3D {
  sky: string;        // background colour
  fog: string;        // fog colour
  fogNear: number;
  fogFar: number;
  floorA: string;     // ground checker tones
  floorB: string;
  wall: string;
  trim: string;       // wall caps / pillars / doorframes
  pedestal: string;
  sun: string;        // directional light colour
  sunIntensity: number;
  ambient: number;    // ambient light intensity
  stars: boolean;     // night-sky themes get a starfield
  skyDome: boolean;   // day themes get a real sky dome
  water: boolean;     // surround the map with water (beach)
  accent: string;     // emissive accent (due-locus glow ring base)
  dressing: string[]; // DecorKind ids sprinkled around the map automatically
}

export const THEME_3D: Record<PalaceTheme, Theme3D> = {
  overworld: {
    sky: '#a8ddf2', fog: '#cdebf7', fogNear: 30, fogFar: 95,
    floorA: '#74b258', floorB: '#69a64e', wall: '#c9b287', trim: '#8a6f4d', pedestal: '#7a6a52',
    sun: '#fff3d6', sunIntensity: 1.6, ambient: 0.55, stars: false, skyDome: true, water: false,
    accent: '#ffd166', dressing: ['tree', 'rock', 'fence', 'shrub'],
  },
  castle: {
    sky: '#d7e0e9', fog: '#d8e1ea', fogNear: 28, fogFar: 90,
    floorA: '#929ba3', floorB: '#878f98', wall: '#b6b0a4', trim: '#6b675e', pedestal: '#5d594f',
    sun: '#f4ecdd', sunIntensity: 1.4, ambient: 0.5, stars: false, skyDome: true, water: false,
    accent: '#ffd166', dressing: ['banner', 'statue', 'crate', 'torch'],
  },
  dungeon: {
    sky: '#0b0911', fog: '#0b0911', fogNear: 9, fogFar: 42,
    floorA: '#27232f', floorB: '#211d29', wall: '#393344', trim: '#191621', pedestal: '#191621',
    sun: '#ff9d45', sunIntensity: 0.5, ambient: 0.34, stars: true, skyDome: false, water: false,
    accent: '#ff9d45', dressing: ['torch', 'barrel', 'rock', 'crate'],
  },
  forest: {
    sky: '#11281b', fog: '#163524', fogNear: 12, fogFar: 52,
    floorA: '#2f5c39', floorB: '#28522f', wall: '#4a3b2a', trim: '#2c2316', pedestal: '#3a4a33',
    sun: '#cfe8b0', sunIntensity: 0.9, ambient: 0.42, stars: false, skyDome: false, water: false,
    accent: '#a3e635', dressing: ['tree', 'shrub', 'rock', 'lamp'],
  },
  beach: {
    sky: '#bfe8f7', fog: '#daf2fb', fogNear: 30, fogFar: 100,
    floorA: '#e9d9a8', floorB: '#e2d09a', wall: '#e6e3da', trim: '#b0884e', pedestal: '#c9b793',
    sun: '#fff7e0', sunIntensity: 1.7, ambient: 0.6, stars: false, skyDome: true, water: true,
    accent: '#2bb3c0', dressing: ['rock', 'shrub', 'crate', 'fence'],
  },
  lab: {
    sky: '#080d1c', fog: '#080d1c', fogNear: 14, fogFar: 55,
    floorA: '#172139', floorB: '#131c31', wall: '#22304e', trim: '#0d1424', pedestal: '#101b30',
    sun: '#9fd8ff', sunIntensity: 0.7, ambient: 0.45, stars: true, skyDome: false, water: false,
    accent: '#41e0d0', dressing: ['lamp', 'crate', 'barrel'],
  },
};

// Centre of a tile in world coordinates.
export function tileCenter(tx: number, ty: number): { x: number; z: number } {
  return { x: (tx + 0.5) * SCALE, z: (ty + 0.5) * SCALE };
}

function wallAlongX(x0: number, x1: number, z: number, out: WallBox[]) {
  if (x1 - x0 < 0.05) return;
  out.push({
    minX: x0, maxX: x1,
    minZ: z - WALL_THICKNESS / 2, maxZ: z + WALL_THICKNESS / 2,
    height: WALL_HEIGHT,
  });
}

function wallAlongZ(z0: number, z1: number, x: number, out: WallBox[]) {
  if (z1 - z0 < 0.05) return;
  out.push({
    minX: x - WALL_THICKNESS / 2, maxX: x + WALL_THICKNESS / 2,
    minZ: z0, maxZ: z1,
    height: WALL_HEIGHT,
  });
}

// A doorway in a room wall — used to render frames and to keep procedural
// dressing from blocking the entrance.
export interface Doorway {
  x: number;          // centre of the gap, world coords
  z: number;
  axis: 'x' | 'z';    // direction the wall runs (frame is perpendicular)
}

// A wall run with a doorway gap in the middle — or a solid run when the side
// is too short to take a door.
function wallWithDoor(
  a0: number,
  a1: number,
  addRun: (s0: number, s1: number) => void,
  onDoor?: (centre: number) => void,
) {
  const len = a1 - a0;
  if (len < DOOR_WIDTH + 1.2) {
    addRun(a0, a1);
    return;
  }
  const mid = (a0 + a1) / 2;
  addRun(a0, mid - DOOR_WIDTH / 2);
  addRun(mid + DOOR_WIDTH / 2, a1);
  onDoor?.(mid);
}

export function roomStructure(room: PalaceRoom): { walls: WallBox[]; doorways: Doorway[] } {
  const walls: WallBox[] = [];
  const doorways: Doorway[] = [];
  const x0 = room.x * SCALE;
  const z0 = room.y * SCALE;
  const x1 = (room.x + room.width) * SCALE;
  const z1 = (room.y + room.height) * SCALE;
  wallWithDoor(x0, x1, (s0, s1) => wallAlongX(s0, s1, z0, walls), (c) => doorways.push({ x: c, z: z0, axis: 'x' }));
  wallWithDoor(x0, x1, (s0, s1) => wallAlongX(s0, s1, z1, walls), (c) => doorways.push({ x: c, z: z1, axis: 'x' }));
  wallWithDoor(z0, z1, (s0, s1) => wallAlongZ(s0, s1, x0, walls), (c) => doorways.push({ x: x0, z: c, axis: 'z' }));
  wallWithDoor(z0, z1, (s0, s1) => wallAlongZ(s0, s1, x1, walls), (c) => doorways.push({ x: x1, z: c, axis: 'z' }));
  return { walls, doorways };
}

export function perimeterWalls(data: MemoryPalaceData): WallBox[] {
  const out: WallBox[] = [];
  const w = data.width * SCALE;
  const h = data.height * SCALE;
  wallAlongX(0, w, 0, out);
  wallAlongX(0, w, h, out);
  wallAlongZ(0, h, 0, out);
  wallAlongZ(0, h, w, out);
  return out;
}

export function buildWalls(data: MemoryPalaceData): WallBox[] {
  return [...perimeterWalls(data), ...data.rooms.flatMap((r) => roomStructure(r).walls)];
}

export function buildDoorways(data: MemoryPalaceData): Doorway[] {
  return data.rooms.flatMap((r) => roomStructure(r).doorways);
}

// ── Procedural set-dressing ────────────────────────────────────────────
// Sprinkle theme props around the open ground so a fresh palace already
// feels like a place. Seeded by palace id — the same palace always grows
// the same trees. Avoids rooms, doorways, loci, and the perimeter.

export interface Dressing {
  kind: string;
  x: number;      // world coords
  z: number;
  rot: number;
  scale: number;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDressing(
  data: MemoryPalaceData,
  kinds: string[],
  seedKey: string,
): Dressing[] {
  if (kinds.length === 0) return [];
  const rng = mulberry32(hashSeed(seedKey));
  const out: Dressing[] = [];
  const doorways = buildDoorways(data);
  const margin = 1.6;
  const target = Math.min(26, 10 + Math.floor((data.width * data.height) / 22));
  let attempts = 0;
  while (out.length < target && attempts < target * 14) {
    attempts++;
    const x = margin + rng() * (data.width * SCALE - margin * 2);
    const z = margin + rng() * (data.height * SCALE - margin * 2);
    // Stay out of rooms (with a buffer so props don't kiss the walls).
    const inRoom = data.rooms.some((r) =>
      x > (r.x - 0.6) * SCALE && x < (r.x + r.width + 0.6) * SCALE &&
      z > (r.y - 0.6) * SCALE && z < (r.y + r.height + 0.6) * SCALE,
    );
    if (inRoom) continue;
    // Keep doorway approaches clear.
    if (doorways.some((d) => (d.x - x) ** 2 + (d.z - z) ** 2 < 3.2 ** 2)) continue;
    // Keep loci visible from afar.
    if (data.objects.some((o) => {
      const c = tileCenter(o.x, o.y);
      return (c.x - x) ** 2 + (c.z - z) ** 2 < 3 ** 2;
    })) continue;
    // Don't clump.
    if (out.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 2.2 ** 2)) continue;
    out.push({
      kind: kinds[Math.floor(rng() * kinds.length)],
      x, z,
      rot: rng() * Math.PI * 2,
      scale: 0.85 + rng() * 0.5,
    });
  }
  return out;
}

// Circle-vs-AABB push-out. Two passes keeps corners stable without a real
// physics engine — plenty for walking speed.
export function collide(x: number, z: number, walls: WallBox[]): { x: number; z: number } {
  const r = PLAYER_RADIUS;
  for (let pass = 0; pass < 2; pass++) {
    for (const w of walls) {
      const cx = Math.max(w.minX, Math.min(x, w.maxX));
      const cz = Math.max(w.minZ, Math.min(z, w.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // Centre is inside the box — push out along the thinnest axis.
        const pushW = Math.min(x - w.minX + r, w.maxX - x + r);
        const pushH = Math.min(z - w.minZ + r, w.maxZ - z + r);
        if (pushW < pushH) x = x - w.minX + r < w.maxX - x + r ? w.minX - r : w.maxX + r;
        else z = z - w.minZ + r < w.maxZ - z + r ? w.minZ - r : w.maxZ + r;
      }
    }
  }
  return { x, z };
}

export function clampToMap(x: number, z: number, data: MemoryPalaceData): { x: number; z: number } {
  const pad = PLAYER_RADIUS + WALL_THICKNESS;
  return {
    x: Math.max(pad, Math.min(data.width * SCALE - pad, x)),
    z: Math.max(pad, Math.min(data.height * SCALE - pad, z)),
  };
}

// Spawn just inside the doorway of the first room, facing its centre — or
// the map centre when the palace is empty.
export function spawnPoint(data: MemoryPalaceData): { x: number; z: number; yaw: number } {
  const r = data.rooms[0];
  if (!r) {
    return { x: (data.width / 2) * SCALE, z: (data.height / 2) * SCALE, yaw: 0 };
  }
  const cx = (r.x + r.width / 2) * SCALE;
  // Stand just outside the room's south doorway, facing north (-z) into it.
  const z = (r.y + r.height) * SCALE + 2.2;
  return { x: cx, z, yaw: 0 };
}
