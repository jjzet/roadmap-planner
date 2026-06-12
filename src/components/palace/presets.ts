// Theme-aligned presets for memory palaces.
//
// The user picks a palace theme up-front; from there everything is fixed:
//   - which rooms can be added (e.g. Castle → Throne Room, Armoury, Dungeon)
//   - which objects can be placed in each room (e.g. Armoury → Weapon Rack,
//     Shield Stand, Arms Chest)
//
// This keeps every palace coherent and on-theme, and gives the spaced-
// repetition / agent layers a stable taxonomy to reason against.

import type { PalaceObjectIcon, PalaceTheme } from '@/types';

export interface RoomKind {
  id: string;     // stable key, persisted on PalaceRoom.kind
  name: string;   // display name
  color: string;  // floor tint
}

export interface ObjectKind {
  id: string;
  name: string;
  icon: PalaceObjectIcon;
  color: string;
}

export const THEME_ROOMS: Record<PalaceTheme, RoomKind[]> = {
  beach: [
    { id: 'beach-hut',       name: 'Beach Hut',       color: '#FCD34D' },
    { id: 'lifeguard-tower', name: 'Lifeguard Tower', color: '#FCA5A5' },
    { id: 'pier',            name: 'Pier',            color: '#A7F3D0' },
    { id: 'tide-pool',       name: 'Tide Pool',       color: '#7DD3FC' },
    { id: 'sand-castle',     name: 'Sand Castle',     color: '#FDBA74' },
    { id: 'cove',            name: 'Cove',            color: '#86EFAC' },
    { id: 'shipwreck',       name: 'Shipwreck',       color: '#A8A29E' },
    { id: 'boardwalk',       name: 'Boardwalk',       color: '#FBBF24' },
  ],
  castle: [
    { id: 'throne-room',  name: 'Throne Room',  color: '#FCD34D' },
    { id: 'armoury',      name: 'Armoury',      color: '#94A3B8' },
    { id: 'dungeon-cell', name: 'Dungeon',      color: '#52525B' },
    { id: 'grain-store',  name: 'Grain Store',  color: '#FBBF24' },
    { id: 'kitchen',      name: 'Kitchen',      color: '#F97316' },
    { id: 'library',      name: 'Library',      color: '#C4B5FD' },
    { id: 'tower',        name: 'Tower',        color: '#A8A29E' },
    { id: 'courtyard',    name: 'Courtyard',    color: '#86EFAC' },
    { id: 'chapel',       name: 'Chapel',       color: '#E9D5FF' },
    { id: 'stables',      name: 'Stables',      color: '#D6A35C' },
    { id: 'war-room',     name: 'War Room',     color: '#FCA5A5' },
  ],
  dungeon: [
    { id: 'crypt',          name: 'Crypt',          color: '#71717A' },
    { id: 'treasure-vault', name: 'Treasure Vault', color: '#FCD34D' },
    { id: 'trap-room',      name: 'Trap Room',      color: '#FCA5A5' },
    { id: 'boss-chamber',   name: 'Boss Chamber',   color: '#A78BFA' },
    { id: 'cell-block',     name: 'Cell Block',     color: '#52525B' },
    { id: 'mushroom-cavern',  name: 'Mushroom Cavern',  color: '#F0ABFC' },
    { id: 'underground-lake', name: 'Underground Lake', color: '#67E8F9' },
  ],
  forest: [
    { id: 'glade',         name: 'Glade',         color: '#86EFAC' },
    { id: 'hollow-tree',   name: 'Hollow Tree',   color: '#A3E635' },
    { id: 'mushroom-ring', name: 'Mushroom Ring', color: '#FCA5A5' },
    { id: 'brook',         name: 'Brook',         color: '#7DD3FC' },
    { id: 'cabin',         name: 'Cabin',         color: '#FDBA74' },
    { id: 'ranger-camp',   name: 'Ranger Camp',   color: '#FCD34D' },
    { id: 'ancient-ruins', name: 'Ancient Ruins', color: '#D6D3D1' },
  ],
  overworld: [
    { id: 'village-square', name: 'Village Square', color: '#FCD34D' },
    { id: 'forest-path',    name: 'Forest Path',    color: '#86EFAC' },
    { id: 'bridge',         name: 'Bridge',         color: '#A8A29E' },
    { id: 'crossroads',     name: 'Crossroads',     color: '#FDBA74' },
    { id: 'market',         name: 'Market',         color: '#FCA5A5' },
    { id: 'inn',            name: 'Inn',            color: '#C4B5FD' },
    { id: 'farm',           name: 'Farm',           color: '#FDE68A' },
    { id: 'harbor',         name: 'Harbor',         color: '#7DD3FC' },
  ],
  lab: [
    { id: 'lab-bench',      name: 'Lab Bench',      color: '#7DD3FC' },
    { id: 'specimen-room',  name: 'Specimen Room',  color: '#86EFAC' },
    { id: 'cold-storage',   name: 'Cold Storage',   color: '#BAE6FD' },
    { id: 'server-room',    name: 'Server Room',    color: '#A78BFA' },
    { id: 'containment',    name: 'Containment',    color: '#FCA5A5' },
    { id: 'observatory',    name: 'Observatory',    color: '#C4B5FD' },
    { id: 'greenhouse',     name: 'Greenhouse',     color: '#86EFAC' },
  ],
};

// Object kinds keyed by RoomKind.id. Icons are constrained to the existing
// PALACE_ICONS set so PixelSprite can render them without new artwork.
export const ROOM_OBJECTS: Record<string, ObjectKind[]> = {
  // ── Beach ─────────────────────────────────────────────────────────
  'beach-hut': [
    { id: 'towel',    name: 'Towel',    icon: 'sign',    color: '#06B6D4' },
    { id: 'cooler',   name: 'Cooler',   icon: 'chest',   color: '#3B82F6' },
    { id: 'umbrella', name: 'Umbrella', icon: 'tree',    color: '#EC4899' },
    { id: 'bucket',   name: 'Bucket',   icon: 'potion',  color: '#F59E0B' },
  ],
  'lifeguard-tower': [
    { id: 'whistle',    name: 'Whistle',    icon: 'star',  color: '#F59E0B' },
    { id: 'binoculars', name: 'Binoculars', icon: 'gem',   color: '#06B6D4' },
    { id: 'megaphone',  name: 'Megaphone',  icon: 'sign',  color: '#EF4444' },
    { id: 'first-aid',  name: 'First Aid',  icon: 'heart', color: '#EF4444' },
  ],
  'pier': [
    { id: 'fishing-pole', name: 'Fishing Pole', icon: 'sword',   color: '#3B82F6' },
    { id: 'pier-lantern', name: 'Pier Lantern', icon: 'lantern', color: '#F59E0B' },
    { id: 'rope-coil',    name: 'Rope Coil',    icon: 'scroll',  color: '#A8A29E' },
    { id: 'crate',        name: 'Crate',        icon: 'chest',   color: '#92400E' },
  ],
  'tide-pool': [
    { id: 'shell',    name: 'Shell',    icon: 'gem',  color: '#EC4899' },
    { id: 'starfish', name: 'Starfish', icon: 'star', color: '#F97316' },
    { id: 'crab',     name: 'Crab',     icon: 'npc',  color: '#EF4444' },
    { id: 'seaweed',  name: 'Seaweed',  icon: 'tree', color: '#10B981' },
  ],
  'sand-castle': [
    { id: 'flag',        name: 'Flag',        icon: 'sign',  color: '#EF4444' },
    { id: 'buried-gem',  name: 'Buried Gem',  icon: 'gem',   color: '#8B5CF6' },
    { id: 'shovel',      name: 'Shovel',      icon: 'sword', color: '#F59E0B' },
  ],
  'cove': [
    { id: 'pirates-chest',   name: 'Pirate\'s Chest',    icon: 'chest',   color: '#F59E0B' },
    { id: 'message-bottle',  name: 'Message in Bottle',  icon: 'potion',  color: '#06B6D4' },
    { id: 'compass',         name: 'Compass',            icon: 'crystal', color: '#3B82F6' },
  ],

  // ── Castle ────────────────────────────────────────────────────────
  'throne-room': [
    { id: 'throne',        name: 'Throne',        icon: 'sign',   color: '#F59E0B' },
    { id: 'crown',         name: 'Crown',         icon: 'gem',    color: '#FCD34D' },
    { id: 'royal-banner',  name: 'Royal Banner',  icon: 'sign',   color: '#EF4444' },
    { id: 'goblet',        name: 'Goblet',        icon: 'potion', color: '#FCD34D' },
    { id: 'royal-decree',  name: 'Royal Decree',  icon: 'scroll', color: '#8B5CF6' },
  ],
  'armoury': [
    { id: 'weapon-rack',  name: 'Weapon Rack',  icon: 'sword',  color: '#A8A29E' },
    { id: 'shield-stand', name: 'Shield Stand', icon: 'shield', color: '#3B82F6' },
    { id: 'helmet',       name: 'Helmet',       icon: 'shield', color: '#94A3B8' },
    { id: 'arms-chest',   name: 'Arms Chest',   icon: 'chest',  color: '#92400E' },
  ],
  'dungeon-cell': [
    { id: 'cell-key',  name: 'Cell Key',  icon: 'key',     color: '#A8A29E' },
    { id: 'torch',     name: 'Torch',     icon: 'lantern', color: '#F97316' },
    { id: 'manacles',  name: 'Manacles',  icon: 'sword',   color: '#52525B' },
    { id: 'prisoner',  name: 'Prisoner',  icon: 'npc',     color: '#A8A29E' },
  ],
  'grain-store': [
    { id: 'sack',     name: 'Sack of Grain', icon: 'chest', color: '#FBBF24' },
    { id: 'barrel',   name: 'Barrel',        icon: 'chest', color: '#92400E' },
    { id: 'scales',   name: 'Scales',        icon: 'gem',   color: '#A8A29E' },
    { id: 'ledger',   name: 'Ledger',        icon: 'book',  color: '#7C2D12' },
  ],
  'kitchen': [
    { id: 'cauldron',   name: 'Cauldron',   icon: 'potion', color: '#52525B' },
    { id: 'bread',      name: 'Bread',      icon: 'gem',    color: '#F59E0B' },
    { id: 'spice-rack', name: 'Spice Rack', icon: 'sign',   color: '#EF4444' },
    { id: 'cleaver',    name: 'Cleaver',    icon: 'sword',  color: '#A8A29E' },
  ],
  'library': [
    { id: 'tome',      name: 'Tome',      icon: 'book',    color: '#8B5CF6' },
    { id: 'scroll',    name: 'Scroll',    icon: 'scroll',  color: '#F59E0B' },
    { id: 'globe',     name: 'Globe',     icon: 'crystal', color: '#3B82F6' },
    { id: 'lectern',   name: 'Lectern',   icon: 'sign',    color: '#92400E' },
    { id: 'astrolabe', name: 'Astrolabe', icon: 'gem',     color: '#FCD34D' },
  ],
  'tower': [
    { id: 'spyglass',       name: 'Spyglass',       icon: 'crystal', color: '#06B6D4' },
    { id: 'tower-beacon',   name: 'Tower Beacon',   icon: 'lantern', color: '#F59E0B' },
    { id: 'tower-pennant',  name: 'Tower Pennant',  icon: 'sign',    color: '#EF4444' },
    { id: 'wizard',         name: 'Wizard',         icon: 'npc',     color: '#8B5CF6' },
  ],
  'courtyard': [
    { id: 'fountain', name: 'Fountain', icon: 'crystal', color: '#06B6D4' },
    { id: 'statue',   name: 'Statue',   icon: 'npc',     color: '#A8A29E' },
    { id: 'oak-tree', name: 'Oak Tree', icon: 'tree',    color: '#10B981' },
    { id: 'sundial',  name: 'Sundial',  icon: 'gem',     color: '#FBBF24' },
  ],

  // ── Dungeon ───────────────────────────────────────────────────────
  'crypt': [
    { id: 'sarcophagus', name: 'Sarcophagus', icon: 'chest',  color: '#A8A29E' },
    { id: 'skull',       name: 'Skull',       icon: 'npc',    color: '#FBBF24' },
    { id: 'urn',         name: 'Urn',         icon: 'potion', color: '#52525B' },
    { id: 'inscription', name: 'Inscription', icon: 'scroll', color: '#71717A' },
  ],
  'treasure-vault': [
    { id: 'gold-pile',     name: 'Pile of Gold',  icon: 'gem',   color: '#FCD34D' },
    { id: 'treasure-chest',name: 'Treasure Chest',icon: 'chest', color: '#F59E0B' },
    { id: 'jewelled-crown',name: 'Jewelled Crown',icon: 'gem',   color: '#8B5CF6' },
    { id: 'magic-sword',   name: 'Magic Sword',   icon: 'sword', color: '#06B6D4' },
  ],
  'trap-room': [
    { id: 'trip-wire',      name: 'Trip Wire',      icon: 'scroll', color: '#A8A29E' },
    { id: 'pressure-plate', name: 'Pressure Plate', icon: 'shield', color: '#71717A' },
    { id: 'spike-trap',     name: 'Spike Trap',     icon: 'sword',  color: '#EF4444' },
    { id: 'pit',            name: 'Pit',            icon: 'chest',  color: '#52525B' },
  ],
  'boss-chamber': [
    { id: 'boss',         name: 'Boss',         icon: 'npc',     color: '#EF4444' },
    { id: 'altar',        name: 'Altar',        icon: 'sign',    color: '#8B5CF6' },
    { id: 'crystal-orb',  name: 'Crystal Orb',  icon: 'crystal', color: '#A78BFA' },
    { id: 'rune',         name: 'Rune',         icon: 'gem',     color: '#10B981' },
  ],
  'cell-block': [
    { id: 'rusty-key',  name: 'Rusty Key',   icon: 'key',    color: '#92400E' },
    { id: 'iron-bars',  name: 'Iron Bars',   icon: 'shield', color: '#52525B' },
    { id: 'tally',      name: 'Tally Marks', icon: 'scroll', color: '#A8A29E' },
    { id: 'jailer',     name: 'Jailer',      icon: 'npc',    color: '#71717A' },
  ],

  // ── Forest ────────────────────────────────────────────────────────
  'glade': [
    { id: 'wildflower', name: 'Wildflower', icon: 'star', color: '#EC4899' },
    { id: 'butterfly',  name: 'Butterfly',  icon: 'gem',  color: '#FCD34D' },
    { id: 'fawn',       name: 'Fawn',       icon: 'npc',  color: '#92400E' },
  ],
  'hollow-tree': [
    { id: 'owl',          name: 'Owl',          icon: 'npc',   color: '#92400E' },
    { id: 'hidden-cache', name: 'Hidden Cache', icon: 'chest', color: '#F59E0B' },
    { id: 'rune-stone',   name: 'Rune Stone',   icon: 'gem',   color: '#10B981' },
  ],
  'mushroom-ring': [
    { id: 'red-cap',  name: 'Red Cap',  icon: 'tree',    color: '#EF4444' },
    { id: 'glow-cap', name: 'Glow Cap', icon: 'lantern', color: '#10B981' },
    { id: 'sprite',   name: 'Sprite',   icon: 'star',    color: '#EC4899' },
  ],
  'brook': [
    { id: 'pebble',   name: 'Pebble',   icon: 'gem',  color: '#A8A29E' },
    { id: 'fish',     name: 'Fish',     icon: 'gem',  color: '#06B6D4' },
    { id: 'lily-pad', name: 'Lily Pad', icon: 'tree', color: '#10B981' },
  ],
  'cabin': [
    { id: 'fireplace',   name: 'Fireplace',   icon: 'lantern', color: '#F97316' },
    { id: 'log-store',   name: 'Log Store',   icon: 'tree',    color: '#92400E' },
    { id: 'hunting-bow', name: 'Hunting Bow', icon: 'sword',   color: '#92400E' },
    { id: 'pelt',        name: 'Pelt',        icon: 'shield',  color: '#7C2D12' },
  ],

  // ── Overworld ─────────────────────────────────────────────────────
  'village-square': [
    { id: 'well',         name: 'Well',         icon: 'crystal', color: '#06B6D4' },
    { id: 'noticeboard',  name: 'Noticeboard',  icon: 'sign',    color: '#92400E' },
    { id: 'merchant',     name: 'Merchant',     icon: 'npc',     color: '#F59E0B' },
    { id: 'cart',         name: 'Cart',         icon: 'chest',   color: '#92400E' },
  ],
  'forest-path': [
    { id: 'milestone',    name: 'Milestone',    icon: 'sign', color: '#A8A29E' },
    { id: 'wanderer',     name: 'Wanderer',     icon: 'npc',  color: '#7C2D12' },
    { id: 'wild-berries', name: 'Wild Berries', icon: 'gem',  color: '#EF4444' },
  ],
  'bridge': [
    { id: 'troll',          name: 'Troll',          icon: 'npc',     color: '#10B981' },
    { id: 'bridge-lantern', name: 'Bridge Lantern', icon: 'lantern', color: '#F59E0B' },
    { id: 'toll-sign',      name: 'Toll Sign',      icon: 'sign',    color: '#92400E' },
  ],
  'crossroads': [
    { id: 'signpost',          name: 'Signpost',           icon: 'sign',    color: '#92400E' },
    { id: 'shrine',            name: 'Shrine',             icon: 'lantern', color: '#FCD34D' },
    { id: 'wandering-merchant',name: 'Wandering Merchant', icon: 'npc',     color: '#F59E0B' },
  ],
  'market': [
    { id: 'fruit-stall',     name: 'Fruit Stall',     icon: 'gem',    color: '#EF4444' },
    { id: 'spice-trader',    name: 'Spice Trader',    icon: 'npc',    color: '#F59E0B' },
    { id: 'bolts-of-cloth',  name: 'Bolts of Cloth',  icon: 'chest',  color: '#8B5CF6' },
    { id: 'apothecary',      name: 'Apothecary',      icon: 'potion', color: '#10B981' },
  ],
  'inn': [
    { id: 'hearth',     name: 'Hearth',     icon: 'lantern', color: '#F97316' },
    { id: 'bard',       name: 'Bard',       icon: 'npc',     color: '#8B5CF6' },
    { id: 'mug',        name: 'Mug',        icon: 'potion',  color: '#F59E0B' },
    { id: 'guest-book', name: 'Guest Book', icon: 'book',    color: '#92400E' },
  ],

  // ── Lab ───────────────────────────────────────────────────────────
  'lab-bench': [
    { id: 'beaker',      name: 'Beaker',      icon: 'potion',  color: '#10B981' },
    { id: 'microscope',  name: 'Microscope',  icon: 'crystal', color: '#06B6D4' },
    { id: 'notebook',    name: 'Notebook',    icon: 'book',    color: '#3B82F6' },
    { id: 'sample-tray', name: 'Sample Tray', icon: 'chest',   color: '#A8A29E' },
  ],
  'specimen-room': [
    { id: 'specimen-jar',       name: 'Specimen Jar',       icon: 'potion', color: '#10B981' },
    { id: 'bone-fragment',      name: 'Bone Fragment',      icon: 'gem',    color: '#F5F5F4' },
    { id: 'preserved-creature', name: 'Preserved Creature', icon: 'npc',    color: '#8B5CF6' },
  ],
  'cold-storage': [
    { id: 'cryo-tube',      name: 'Cryo Tube',      icon: 'crystal', color: '#06B6D4' },
    { id: 'frozen-sample',  name: 'Frozen Sample',  icon: 'gem',     color: '#7DD3FC' },
    { id: 'freezer-locker', name: 'Freezer Locker', icon: 'chest',   color: '#94A3B8' },
  ],
  'server-room': [
    { id: 'mainframe',     name: 'Mainframe',     icon: 'sign',    color: '#1F2937' },
    { id: 'crystal-core',  name: 'Crystal Core',  icon: 'crystal', color: '#A78BFA' },
    { id: 'cable-bundle',  name: 'Cable Bundle',  icon: 'scroll',  color: '#06B6D4' },
  ],
  'containment': [
    { id: 'bio-hazard',   name: 'Bio Hazard',   icon: 'star',   color: '#F59E0B' },
    { id: 'sealed-vault', name: 'Sealed Vault', icon: 'chest',  color: '#EF4444' },
    { id: 'hazmat-suit',  name: 'Hazmat Suit',  icon: 'shield', color: '#FCD34D' },
    { id: 'security-key', name: 'Security Key', icon: 'key',    color: '#52525B' },
  ],
  // ── Beach (new rooms) ─────────────────────────────────────────────
  'shipwreck': [
    { id: 'ships-wheel',   name: "Ship's Wheel",   icon: 'crystal', color: '#92400E' },
    { id: 'broken-mast',   name: 'Broken Mast',    icon: 'tree',    color: '#A8A29E' },
    { id: 'cargo-net',     name: 'Cargo Net',      icon: 'scroll',  color: '#7C5A32' },
    { id: 'captains-log',  name: "Captain's Log",  icon: 'book',    color: '#3B82F6' },
  ],
  'boardwalk': [
    { id: 'ice-cream-cart', name: 'Ice Cream Cart', icon: 'chest',   color: '#EC4899' },
    { id: 'beach-ball',     name: 'Beach Ball',     icon: 'gem',     color: '#EF4444' },
    { id: 'surfboard',      name: 'Surfboard',      icon: 'shield',  color: '#06B6D4' },
    { id: 'boardwalk-lamp', name: 'Boardwalk Lamp', icon: 'lantern', color: '#F59E0B' },
  ],

  // ── Castle (new rooms) ────────────────────────────────────────────
  'chapel': [
    { id: 'chapel-candles', name: 'Chapel Candles', icon: 'lantern', color: '#FCD34D' },
    { id: 'stained-glass',  name: 'Stained Glass',  icon: 'gem',     color: '#8B5CF6' },
    { id: 'prayer-book',    name: 'Prayer Book',    icon: 'book',    color: '#7C2D12' },
    { id: 'reliquary',      name: 'Reliquary',      icon: 'chest',   color: '#FCD34D' },
  ],
  'stables': [
    { id: 'saddle',         name: 'Saddle',         icon: 'shield',  color: '#92400E' },
    { id: 'hay-bale',       name: 'Hay Bale',       icon: 'chest',   color: '#FBBF24' },
    { id: 'horseshoe',      name: 'Horseshoe',      icon: 'key',     color: '#A8A29E' },
    { id: 'stable-lantern', name: 'Stable Lantern', icon: 'lantern', color: '#F97316' },
  ],
  'war-room': [
    { id: 'campaign-map',     name: 'Campaign Map',     icon: 'scroll', color: '#92400E' },
    { id: 'war-banner',       name: 'War Banner',       icon: 'sign',   color: '#EF4444' },
    { id: 'commanders-blade', name: "Commander's Blade", icon: 'sword', color: '#94A3B8' },
    { id: 'signal-horn',      name: 'Signal Horn',      icon: 'star',   color: '#F59E0B' },
  ],

  // ── Dungeon (new rooms) ───────────────────────────────────────────
  'mushroom-cavern': [
    { id: 'giant-mushroom', name: 'Giant Mushroom', icon: 'tree', color: '#EC4899' },
    { id: 'spore-cloud',    name: 'Spore Cloud',    icon: 'star', color: '#C4B5FD' },
    { id: 'cave-moth',      name: 'Cave Moth',      icon: 'npc',  color: '#A8A29E' },
  ],
  'underground-lake': [
    { id: 'ferrymans-boat', name: "Ferryman's Boat", icon: 'chest',   color: '#52525B' },
    { id: 'pale-fish',      name: 'Pale Fish',       icon: 'gem',     color: '#BAE6FD' },
    { id: 'echo-stone',     name: 'Echo Stone',      icon: 'crystal', color: '#67E8F9' },
  ],

  // ── Forest (new rooms) ────────────────────────────────────────────
  'ranger-camp': [
    { id: 'camp-fire-ring', name: 'Campfire',    icon: 'lantern', color: '#F97316' },
    { id: 'rangers-bow',    name: "Ranger's Bow", icon: 'sword',  color: '#92400E' },
    { id: 'trail-map',      name: 'Trail Map',   icon: 'scroll',  color: '#10B981' },
    { id: 'bedroll',        name: 'Bedroll',     icon: 'shield',  color: '#7C5A32' },
  ],
  'ancient-ruins': [
    { id: 'fallen-column',   name: 'Fallen Column',   icon: 'sign',  color: '#A8A29E' },
    { id: 'moss-idol',       name: 'Moss Idol',       icon: 'npc',   color: '#10B981' },
    { id: 'engraved-tablet', name: 'Engraved Tablet', icon: 'book',  color: '#78716C' },
  ],

  // ── Overworld (new rooms) ─────────────────────────────────────────
  'farm': [
    { id: 'scarecrow',     name: 'Scarecrow',  icon: 'npc',   color: '#FBBF24' },
    { id: 'hay-cart',      name: 'Hay Cart',   icon: 'chest', color: '#92400E' },
    { id: 'prize-pig',     name: 'Prize Pig',  icon: 'heart', color: '#EC4899' },
    { id: 'farm-windmill', name: 'Windmill',   icon: 'star',  color: '#A8A29E' },
  ],
  'harbor': [
    { id: 'harbor-lighthouse', name: 'Lighthouse',  icon: 'lantern', color: '#EF4444' },
    { id: 'fishing-net',       name: 'Fishing Net', icon: 'scroll',  color: '#7C5A32' },
    { id: 'harbor-bell',       name: 'Harbor Bell', icon: 'star',    color: '#FCD34D' },
    { id: 'moored-skiff',      name: 'Moored Skiff', icon: 'chest',  color: '#3B82F6' },
  ],

  // ── Lab (new rooms) ───────────────────────────────────────────────
  'observatory': [
    { id: 'telescope',    name: 'Telescope',    icon: 'crystal', color: '#3B82F6' },
    { id: 'star-chart',   name: 'Star Chart',   icon: 'scroll',  color: '#C4B5FD' },
    { id: 'orrery',       name: 'Orrery',       icon: 'gem',     color: '#FCD34D' },
    { id: 'eclipse-lens', name: 'Eclipse Lens', icon: 'shield',  color: '#52525B' },
  ],
  'greenhouse': [
    { id: 'rare-orchid',  name: 'Rare Orchid',  icon: 'tree',    color: '#EC4899' },
    { id: 'watering-can', name: 'Watering Can', icon: 'potion',  color: '#06B6D4' },
    { id: 'seed-vault',   name: 'Seed Vault',   icon: 'chest',   color: '#92400E' },
    { id: 'grow-lamp',    name: 'Grow Lamp',    icon: 'lantern', color: '#A3E635' },
  ],
};

// Used when a room has no `kind` recorded (legacy rooms created before this
// change). Keeps the picker functional without forcing a migration.
export const FALLBACK_OBJECTS: ObjectKind[] = [
  { id: 'note',   name: 'Note',   icon: 'scroll', color: '#06B6D4' },
  { id: 'item',   name: 'Item',   icon: 'chest',  color: '#F59E0B' },
  { id: 'marker', name: 'Marker', icon: 'star',   color: '#EC4899' },
  { id: 'gem',    name: 'Gem',    icon: 'gem',    color: '#8B5CF6' },
];

export function objectsForRoomKind(kind: string | undefined): ObjectKind[] {
  if (!kind) return FALLBACK_OBJECTS;
  return ROOM_OBJECTS[kind] ?? FALLBACK_OBJECTS;
}

// Integrity check: every object kind must be unique across all rooms. The
// memory-palace metaphor relies on each locus being specific to its room —
// shared types blur the spatial mnemonic. Runs at module load so adding a
// duplicate during editing surfaces immediately in the browser console.
(function assertObjectKindsAreRoomUnique() {
  const seen = new Map<string, string>(); // objectKindId -> roomKindId
  const dupes: { id: string; rooms: string[] }[] = [];
  for (const [roomKindId, kinds] of Object.entries(ROOM_OBJECTS)) {
    for (const k of kinds) {
      const prev = seen.get(k.id);
      if (prev && prev !== roomKindId) {
        dupes.push({ id: k.id, rooms: [prev, roomKindId] });
      } else {
        seen.set(k.id, roomKindId);
      }
    }
  }
  if (dupes.length) {
    console.warn(
      '[palace presets] duplicate object kinds across rooms — each room must own its objects:',
      dupes,
    );
  }
})();
