// Palace generator — turns a plain list of things-to-remember into a fully
// laid-out memory palace: themed rooms placed along a walking path, one locus
// per item, each with a suggested vivid image (the actual mnemonic hook).
//
// The layout is boustrophedon (snake): rooms run left→right across the top
// row then right→left across the bottom row, so the canonical walk in
// PalaceWalk moves through physically adjacent rooms. Loci inside a room
// follow the same snake so the path never doubles back.

import type { MemoryPalaceData, PalaceObject, PalaceRoom, PalaceTheme } from '@/types';
import { THEME_ROOMS, ROOM_OBJECTS, FALLBACK_OBJECTS, type ObjectKind } from './presets';

export interface BuilderItem {
  name: string;    // the cue — what's visible at the locus ("Sarah")
  details: string; // the memory — what you're trying to recall ("Design lead…")
}

// One line per item. "Name — details", "Name - details" or "Name: details".
// A line with no separator becomes a cue with empty details.
export function parseItems(text: string): BuilderItem[] {
  const items: BuilderItem[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.+?)\s*(?:—|–|::|:| - )\s*(.+)$/);
    if (m) items.push({ name: m[1].trim(), details: m[2].trim() });
    else items.push({ name: line, details: '' });
  }
  return items;
}

const MAP_W = 24;
const MAP_H = 16;
const ROOM_W = 6;
const ROOM_H = 5;

// Room slots in walk order: top row left→right, bottom row right→left.
const ROOM_SLOTS: Array<{ x: number; y: number }> = [
  { x: 1, y: 2 }, { x: 9, y: 2 }, { x: 17, y: 2 },
  { x: 17, y: 9 }, { x: 9, y: 9 }, { x: 1, y: 9 },
];

// Imagery templates — deterministic by item index so regeneration is stable.
// Absurdity is the point: bizarre images are what make loci stick.
const VERBS = [
  'balancing on', 'juggling', 'arm-wrestling', 'riding', 'polishing',
  'hiding inside', 'dancing with', 'shouting at', 'wearing', 'painting',
];
const TWISTS = [
  'ten times too big', 'glowing neon green', 'completely upside-down',
  'covered in glitter', 'singing opera at full volume', 'made of jelly',
  'spinning like a top', 'raining confetti everywhere',
];

export function suggestImagery(itemName: string, kind: ObjectKind, roomName: string, i: number): string {
  const verb = VERBS[i % VERBS.length];
  const twist = TWISTS[i % TWISTS.length];
  return `Picture ${itemName} ${verb} the ${kind.name.toLowerCase()} in the ${roomName} — ${twist}.`;
}

function uuid(): string {
  return crypto.randomUUID();
}

// Snake through a room's interior, returning up to `count` spread-out cells.
function lociPositions(room: PalaceRoom, count: number): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let ry = 0; ry < room.height - 2; ry++) {
    const rowY = room.y + 1 + ry;
    const xs = Array.from({ length: room.width - 2 }, (_, k) => room.x + 1 + k);
    if (ry % 2 === 1) xs.reverse();
    for (const x of xs) cells.push({ x, y: rowY });
  }
  if (count >= cells.length) return cells.slice(0, count);
  // Spread items along the snake so each locus stays visually distinct.
  const stride = cells.length / count;
  return Array.from({ length: count }, (_, k) => cells[Math.min(Math.floor(k * stride), cells.length - 1)]);
}

export function buildPalaceData(items: BuilderItem[], theme: PalaceTheme): MemoryPalaceData {
  const data: MemoryPalaceData = { width: MAP_W, height: MAP_H, rooms: [], objects: [] };
  if (items.length === 0) return data;

  const kinds = THEME_ROOMS[theme] ?? [];
  const interiorCapacity = (ROOM_W - 2) * (ROOM_H - 2);
  // Aim for ~4 loci per room (sparse loci are easier to visualise), but pack
  // denser rather than overflow once all six slots are taken.
  let roomCount = Math.min(ROOM_SLOTS.length, Math.max(1, Math.ceil(items.length / 4)));
  if (items.length > roomCount * interiorCapacity) {
    roomCount = ROOM_SLOTS.length; // best effort — extra items still get placed below
  }
  const perRoom = Math.ceil(items.length / roomCount);

  for (let r = 0; r < roomCount; r++) {
    const kind = kinds[r % kinds.length];
    const slot = ROOM_SLOTS[r];
    const dupes = data.rooms.filter((x) => x.kind === kind?.id).length;
    data.rooms.push({
      id: uuid(),
      name: kind ? (dupes ? `${kind.name} ${dupes + 1}` : kind.name) : `Room ${r + 1}`,
      description: '',
      x: slot.x,
      y: slot.y,
      width: ROOM_W,
      height: ROOM_H,
      color: kind?.color ?? '#7DD3FC',
      kind: kind?.id,
    });
  }

  let itemIdx = 0;
  for (const room of data.rooms) {
    const take = Math.min(perRoom, items.length - itemIdx);
    if (take <= 0) break;
    const objectKinds = room.kind ? (ROOM_OBJECTS[room.kind] ?? FALLBACK_OBJECTS) : FALLBACK_OBJECTS;
    const spots = lociPositions(room, take);
    for (let k = 0; k < take; k++) {
      const item = items[itemIdx];
      const objKind = objectKinds[k % objectKinds.length];
      const spot = spots[k] ?? { x: room.x + 1, y: room.y + 1 };
      const obj: PalaceObject = {
        id: uuid(),
        name: item.name,
        content: item.details,
        x: spot.x,
        y: spot.y,
        icon: objKind.icon,
        color: objKind.color,
        roomId: room.id,
        kind: objKind.id,
        imagery: suggestImagery(item.name, objKind, room.name, itemIdx),
      };
      data.objects.push(obj);
      itemIdx++;
    }
  }
  return data;
}
