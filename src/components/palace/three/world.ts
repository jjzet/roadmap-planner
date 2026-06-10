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
  floor: string;      // ground plane
  wall: string;
  trim: string;       // wall caps / pillars
  pedestal: string;
  sun: string;        // directional light colour
  sunIntensity: number;
  ambient: number;    // ambient light intensity
  stars: boolean;     // night-sky themes get a starfield
  accent: string;     // emissive accent (due-locus glow ring base)
}

export const THEME_3D: Record<PalaceTheme, Theme3D> = {
  overworld: {
    sky: '#a8ddf2', fog: '#c7e9f6', fogNear: 26, fogFar: 80,
    floor: '#6fae54', wall: '#c9b287', trim: '#8a6f4d', pedestal: '#7a6a52',
    sun: '#fff3d6', sunIntensity: 1.6, ambient: 0.55, stars: false, accent: '#ffd166',
  },
  castle: {
    sky: '#d7e0e9', fog: '#d7e0e9', fogNear: 24, fogFar: 75,
    floor: '#8e979f', wall: '#b6b0a4', trim: '#6b675e', pedestal: '#5d594f',
    sun: '#f4ecdd', sunIntensity: 1.4, ambient: 0.5, stars: false, accent: '#ffd166',
  },
  dungeon: {
    sky: '#0b0911', fog: '#0b0911', fogNear: 8, fogFar: 38,
    floor: '#262230', wall: '#393344', trim: '#191621', pedestal: '#191621',
    sun: '#ff9d45', sunIntensity: 0.5, ambient: 0.32, stars: true, accent: '#ff9d45',
  },
  forest: {
    sky: '#11281b', fog: '#143120', fogNear: 10, fogFar: 46,
    floor: '#2c5737', wall: '#4a3b2a', trim: '#2c2316', pedestal: '#3a4a33',
    sun: '#cfe8b0', sunIntensity: 0.85, ambient: 0.4, stars: false, accent: '#a3e635',
  },
  beach: {
    sky: '#bfe8f7', fog: '#d8f1fa', fogNear: 26, fogFar: 85,
    floor: '#e6d5a3', wall: '#e6e3da', trim: '#b0884e', pedestal: '#c9b793',
    sun: '#fff7e0', sunIntensity: 1.7, ambient: 0.6, stars: false, accent: '#2bb3c0',
  },
  lab: {
    sky: '#080d1c', fog: '#080d1c', fogNear: 12, fogFar: 50,
    floor: '#16203a', wall: '#22304e', trim: '#0d1424', pedestal: '#101b30',
    sun: '#9fd8ff', sunIntensity: 0.7, ambient: 0.42, stars: true, accent: '#41e0d0',
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

// A wall run with a doorway gap in the middle — or a solid run when the side
// is too short to take a door.
function wallWithDoor(a0: number, a1: number, addRun: (s0: number, s1: number) => void) {
  const len = a1 - a0;
  if (len < DOOR_WIDTH + 1.2) {
    addRun(a0, a1);
    return;
  }
  const mid = (a0 + a1) / 2;
  addRun(a0, mid - DOOR_WIDTH / 2);
  addRun(mid + DOOR_WIDTH / 2, a1);
}

export function roomWalls(room: PalaceRoom): WallBox[] {
  const out: WallBox[] = [];
  const x0 = room.x * SCALE;
  const z0 = room.y * SCALE;
  const x1 = (room.x + room.width) * SCALE;
  const z1 = (room.y + room.height) * SCALE;
  wallWithDoor(x0, x1, (s0, s1) => wallAlongX(s0, s1, z0, out)); // north
  wallWithDoor(x0, x1, (s0, s1) => wallAlongX(s0, s1, z1, out)); // south
  wallWithDoor(z0, z1, (s0, s1) => wallAlongZ(s0, s1, x0, out)); // west
  wallWithDoor(z0, z1, (s0, s1) => wallAlongZ(s0, s1, x1, out)); // east
  return out;
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
  return [...perimeterWalls(data), ...data.rooms.flatMap(roomWalls)];
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
