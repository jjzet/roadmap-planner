// First-person walkable palace. The 2D palace data is projected into a 3D
// scene (world.ts) and the spaced-repetition recall loop runs in-world: walk
// up to a glowing locus, try to remember what lives there, press E to check,
// grade yourself with 1/2/3.
//
// Tab toggles decorate mode — a hotbar of props placed with the crosshair.
// Decorations are cosmetic, but personal landmarks are retrieval cues:
// "Sarah is past the two barrels by the torch" is how spatial memory works.
//
// Lazy-loaded (three.js is a heavy chunk) — import via React.lazy only.

/* eslint-disable react-hooks/immutability -- react-three-fiber is an
   imperative escape hatch: mutating the camera and scene objects inside
   useFrame/useEffect is the supported r3f pattern, not a React state
   violation. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Sky, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import type { MemoryPalaceRecord, PalaceDecor, PalaceObject, ReviewQuality } from '@/types';
import { usePalaceReviewStore, reviewKey, isDue } from '@/store/palaceReviewStore';
import { usePalaceStore } from '@/store/palaceStore';
import { bumpStreak } from '../streak';
import {
  THEME_3D, SCALE, EYE_HEIGHT, WALL_HEIGHT, DOOR_WIDTH,
  buildWalls, buildDoorways, generateDressing, collide, clampToMap, spawnPoint, tileCenter,
  type WallBox, type Theme3D, type Doorway,
} from './world';
import { LocusProp } from './Props3D';
import { DecorProp } from './decor';
import { DECOR_KINDS, decorEmitsLight } from './decorKinds';

type Status = 'intro' | 'playing' | 'paused';
type Mode = 'walk' | 'decorate';

interface Palace3DProps {
  palace: MemoryPalaceRecord;
  onExit: () => void;
}

export default function Palace3D({ palace, onExit }: Palace3DProps) {
  const theme = THEME_3D[palace.theme] ?? THEME_3D.overworld;
  const walls = useMemo(() => buildWalls(palace.data), [palace.data]);
  const decor = useMemo(() => palace.data.decor ?? [], [palace.data.decor]);

  const [status, setStatus] = useState<Status>('intro');
  const [mode, setMode] = useState<Mode>('walk');
  const [nearId, setNearId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [justGraded, setJustGraded] = useState<ReviewQuality | null>(null);
  const [gradedCount, setGradedCount] = useState(0);
  const [streak, setStreak] = useState<number | null>(null);
  const [selectedDecor, setSelectedDecor] = useState(0);
  const decorRotRef = useRef(0);

  const controlsRef = useRef<PointerLockControlsImpl | null>(null);
  const statusRef = useRef(status);
  const modeRef = useRef(mode);
  useEffect(() => {
    statusRef.current = status;
    modeRef.current = mode;
  }, [status, mode]);

  const reviews = usePalaceReviewStore((s) => s.reviews);
  const recordReview = usePalaceReviewStore((s) => s.recordReview);
  const setDecorStore = usePalaceStore((s) => s.setDecor);
  const [nowMs] = useState(() => Date.now());

  const dueIds = useMemo(() => {
    const now = new Date(nowMs);
    const set = new Set<string>();
    for (const o of palace.data.objects) {
      if (isDue(reviews[reviewKey(palace.id, o.id)] ?? null, now)) set.add(o.id);
    }
    return set;
  }, [palace.id, palace.data.objects, reviews, nowMs]);

  const nearLocus = nearId
    ? palace.data.objects.find((o) => o.id === nearId) ?? null
    : null;
  const revealed = nearLocus != null && nearLocus.id === revealedId;

  const enter = useCallback(() => {
    setStatus('playing');
    // Pointer lock needs a user gesture; if it fails (e.g. iframe), keyboard
    // movement still works — only mouse-look is lost.
    try { controlsRef.current?.lock(); } catch { /* ignore */ }
  }, []);

  const leave = useCallback(() => {
    try { controlsRef.current?.unlock(); } catch { /* ignore */ }
    onExit();
  }, [onExit]);

  const handleNear = useCallback((id: string | null) => {
    setNearId((prev) => {
      if (prev !== id) setRevealedId(null);
      return id;
    });
  }, []);

  const grade = useCallback((q: ReviewQuality) => {
    if (!nearLocus || nearLocus.id !== revealedId) return;
    void recordReview(palace.id, nearLocus.id, q);
    setRevealedId(null);
    setJustGraded(q);
    setGradedCount((n) => n + 1);
    window.setTimeout(() => setJustGraded(null), 1100);
    // Clearing the last due locus ticks the day streak — same rule as the
    // 2D review session summary.
    if (streak == null && dueIds.size === 1 && dueIds.has(nearLocus.id)) {
      setStreak(bumpStreak());
    }
  }, [nearLocus, revealedId, recordReview, palace.id, streak, dueIds]);

  const placeDecor = useCallback((wx: number, wz: number, rot: number) => {
    const kind = DECOR_KINDS[selectedDecor]?.id;
    if (!kind) return;
    const item: PalaceDecor = {
      id: crypto.randomUUID(),
      kind,
      x: wx / SCALE,
      z: wz / SCALE,
      rot,
    };
    void setDecorStore(palace.id, [...decor, item]);
  }, [selectedDecor, decor, setDecorStore, palace.id]);

  const removeDecor = useCallback((id: string) => {
    void setDecorStore(palace.id, decor.filter((d) => d.id !== id));
  }, [decor, setDecorStore, palace.id]);

  // HUD keys: E/Space reveal, 1/2/3 grade (walk mode); Tab toggles decorate;
  // digits select palette entries in decorate mode. Movement lives in <Player>.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (statusRef.current !== 'playing') return;
      if (e.key === 'Tab') {
        e.preventDefault();
        setRevealedId(null);
        setMode((m) => (m === 'walk' ? 'decorate' : 'walk'));
        return;
      }
      if (modeRef.current === 'decorate') {
        if (e.key >= '0' && e.key <= '9') {
          const idx = e.key === '0' ? 9 : Number(e.key) - 1;
          if (idx < DECOR_KINDS.length) setSelectedDecor(idx);
        } else if (e.key === '[' || e.key === 'ArrowLeft') {
          setSelectedDecor((i) => (i + DECOR_KINDS.length - 1) % DECOR_KINDS.length);
        } else if (e.key === ']' || e.key === 'ArrowRight') {
          setSelectedDecor((i) => (i + 1) % DECOR_KINDS.length);
        }
        return;
      }
      switch (e.key) {
        case 'e': case 'E': case ' ': case 'Enter':
          if (nearLocus && !revealed) {
            e.preventDefault();
            setRevealedId(nearLocus.id);
          }
          break;
        case '1': if (revealed) { e.preventDefault(); grade('hard'); } break;
        case '2': if (revealed) { e.preventDefault(); grade('good'); } break;
        case '3': if (revealed) { e.preventDefault(); grade('easy'); } break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nearLocus, revealed, grade]);

  // Wheel cycles the palette while decorating (works under pointer lock).
  useEffect(() => {
    if (mode !== 'decorate') return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setSelectedDecor((i) =>
        (i + (e.deltaY > 0 ? 1 : DECOR_KINDS.length - 1)) % DECOR_KINDS.length);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [mode]);

  const decorating = status === 'playing' && mode === 'decorate';

  return (
    <div className="flex-1 relative overflow-hidden" style={{ background: theme.sky }}>
      <Canvas
        shadows
        camera={{ fov: 75, near: 0.1, far: 260 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Scene
          palace={palace}
          theme={theme}
          walls={walls}
          decor={decor}
          dueIds={dueIds}
          onNear={handleNear}
          onRoom={setRoomName}
          statusRef={statusRef}
        />
        {decorating && (
          <DecorateController
            palace={palace}
            theme={theme}
            decor={decor}
            selectedKind={DECOR_KINDS[selectedDecor]?.id ?? 'crate'}
            rotRef={decorRotRef}
            onPlace={placeDecor}
            onRemove={removeDecor}
          />
        )}
        <PointerLockControls
          ref={controlsRef}
          onUnlock={() => {
            if (statusRef.current === 'playing') setStatus('paused');
          }}
        />
      </Canvas>

      {/* ── HUD ─────────────────────────────────────────────────────── */}

      {status === 'playing' && (
        <>
          {/* Crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.6)] ${decorating ? 'bg-amber-300' : 'bg-white/80'}`} />
          </div>

          {/* Top bar */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
            <div className="bg-black/45 backdrop-blur-sm rounded px-3 py-2">
              <p className="text-[12px] font-mono font-semibold text-white tracking-wide">
                {palace.name}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/70 mt-0.5">
                {decorating ? 'Decorating' : roomName ?? 'Outside'}
              </p>
            </div>
            {!decorating && (
              <div className="bg-black/45 backdrop-blur-sm rounded px-3 py-2 text-right">
                {dueIds.size > 0 ? (
                  <p className="text-[11px] font-mono text-amber-300">
                    {dueIds.size} {dueIds.size === 1 ? 'locus' : 'loci'} glowing — walk to them
                  </p>
                ) : (
                  <p className="text-[11px] font-mono text-emerald-300">
                    All caught up ✨{streak != null ? ` · ${streak}-day streak` : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Recall card */}
          {!decorating && nearLocus && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[420px] max-w-[90%] pointer-events-none">
              <div className="bg-black/60 backdrop-blur-md rounded-lg px-4 py-3 border border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-mono font-semibold text-white truncate">
                    {nearLocus.name}
                  </p>
                  {dueIds.has(nearLocus.id) && (
                    <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-amber-300 border border-amber-300/40 rounded-full px-2 py-0.5">
                      due
                    </span>
                  )}
                </div>
                {nearLocus.imagery && (
                  <p className="mt-1.5 text-[11px] font-mono font-light italic text-amber-100/90 leading-relaxed">
                    {nearLocus.imagery}
                  </p>
                )}
                {justGraded ? (
                  <p className="mt-2 text-[12px] font-mono text-emerald-300">
                    ✓ Scheduled — it'll come back right when you're about to forget it.
                  </p>
                ) : revealed ? (
                  <>
                    <p className="mt-2 text-[12px] font-mono font-light text-white/95 whitespace-pre-wrap leading-relaxed">
                      {nearLocus.content || 'No memory recorded yet.'}
                    </p>
                    <p className="mt-2.5 text-[10px] font-mono uppercase tracking-wider text-white/60">
                      How did you do? <Key>1</Key> hard · <Key>2</Key> ok · <Key>3</Key> easy
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[11px] font-mono text-white/70">
                    What's stored here? Say it out loud, then press <Key>E</Key> to check.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Decorate palette */}
          {decorating && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="flex items-end gap-1.5 bg-black/55 backdrop-blur-md rounded-lg px-3 py-2.5 border border-white/10">
                {DECOR_KINDS.map((k, i) => (
                  <div key={k.id} className="flex flex-col items-center w-12">
                    <div
                      className={`w-9 h-9 rounded border-2 flex items-center justify-center transition-transform ${
                        i === selectedDecor
                          ? 'border-amber-300 scale-110 bg-white/10'
                          : 'border-white/15 bg-white/5'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-sm" style={{ background: k.swatch }} />
                    </div>
                    <span className={`mt-1 text-[8px] font-mono uppercase tracking-wide truncate max-w-full ${
                      i === selectedDecor ? 'text-amber-200' : 'text-white/40'
                    }`}>
                      {i === selectedDecor ? k.label : (i + 1) % 10 || ''}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-center text-[10px] font-mono uppercase tracking-wider text-white/55">
                click place · right-click remove · <Key>R</Key> rotate · scroll cycle · <Key>Tab</Key> done
              </p>
            </div>
          )}

          {/* Controls hint */}
          {!decorating && (
            <div className="absolute bottom-3 right-3 pointer-events-none">
              <p className="text-[10px] font-mono uppercase tracking-wider text-white/50 bg-black/30 rounded px-2 py-1">
                wasd move · mouse look · tab decorate · esc pause
              </p>
            </div>
          )}
        </>
      )}

      {status === 'intro' && (
        <Overlay theme={theme}>
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/60">
            Memory palace
          </p>
          <h2 className="mt-1 text-[26px] font-mono font-light text-white">
            {palace.name}
          </h2>
          <p className="mt-2 text-[12px] font-mono font-light text-white/70 max-w-[340px] leading-relaxed">
            {dueIds.size > 0
              ? `${dueIds.size} ${dueIds.size === 1 ? 'memory is' : 'memories are'} glowing and due for recall. Walk to each one, remember before you reveal.`
              : 'Wander the rooms, place some landmarks, and let the route burn the memories in.'}
          </p>
          <button
            onClick={enter}
            className="mt-6 text-[12px] font-mono uppercase tracking-[0.18em] text-gray-900 bg-white hover:bg-cyan-50 rounded-full px-6 py-2.5 cursor-pointer transition-colors border-none"
          >
            Step inside
          </button>
          <ControlsLegend />
          <ExitLink onClick={leave} label="Back to map" />
        </Overlay>
      )}

      {status === 'paused' && (
        <Overlay theme={theme}>
          <h2 className="text-[20px] font-mono font-light text-white">Paused</h2>
          {gradedCount > 0 && (
            <p className="mt-1.5 text-[12px] font-mono text-white/70">
              {gradedCount} {gradedCount === 1 ? 'locus' : 'loci'} recalled this walk
              {streak != null ? ` · ${streak}-day streak` : ''}
            </p>
          )}
          <button
            onClick={enter}
            className="mt-5 text-[12px] font-mono uppercase tracking-[0.18em] text-gray-900 bg-white hover:bg-cyan-50 rounded-full px-6 py-2.5 cursor-pointer transition-colors border-none"
          >
            Keep walking
          </button>
          <ControlsLegend />
          <ExitLink onClick={leave} label="Leave palace" />
        </Overlay>
      )}
    </div>
  );
}

// ── Scene ──────────────────────────────────────────────────────────────

interface SceneProps {
  palace: MemoryPalaceRecord;
  theme: Theme3D;
  walls: WallBox[];
  decor: PalaceDecor[];
  dueIds: Set<string>;
  onNear: (id: string | null) => void;
  onRoom: (name: string | null) => void;
  statusRef: React.MutableRefObject<Status>;
}

function Scene({ palace, theme, walls, decor, dueIds, onNear, onRoom, statusRef }: SceneProps) {
  const { data } = palace;
  const w = data.width * SCALE;
  const h = data.height * SCALE;

  const doorways = useMemo(() => buildDoorways(data), [data]);
  const dressing = useMemo(
    () => generateDressing(data, theme.dressing, palace.id),
    [data, theme.dressing, palace.id],
  );

  // Crisp two-tone checker ties the ground back to the 2D map's identity.
  const floorTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 2;
    const g = c.getContext('2d')!;
    g.fillStyle = theme.floorA;
    g.fillRect(0, 0, 2, 2);
    g.fillStyle = theme.floorB;
    g.fillRect(0, 0, 1, 1);
    g.fillRect(1, 1, 1, 1);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(data.width * 2, data.height * 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [theme.floorA, theme.floorB, data.width, data.height]);

  // Light budget: due-locus beacons first, then lit decor (torches, lamps).
  const litDue = useMemo(
    () => data.objects.filter((o) => dueIds.has(o.id)).slice(0, 6),
    [data.objects, dueIds],
  );
  const litDecor = useMemo(() => {
    const user = decor.filter((d) => decorEmitsLight(d.kind))
      .map((d) => ({ x: d.x * SCALE, z: d.z * SCALE }));
    const auto = dressing.filter((d) => decorEmitsLight(d.kind))
      .map((d) => ({ x: d.x, z: d.z }));
    return [...user, ...auto].slice(0, 6);
  }, [decor, dressing]);

  const roomIndex = useMemo(
    () => new Map(data.rooms.map((r, i) => [r.id, i])),
    [data.rooms],
  );

  return (
    <>
      {theme.skyDome ? (
        <Sky distance={450} sunPosition={[120, 65, 80]} turbidity={6} rayleigh={1.1} />
      ) : (
        <color attach="background" args={[theme.sky]} />
      )}
      <fog attach="fog" args={[theme.fog, theme.fogNear, theme.fogFar]} />
      <ambientLight intensity={theme.ambient} />
      <hemisphereLight args={[theme.sky, theme.floorA, 0.5]} />
      <directionalLight
        position={[w * 0.35, 20, h * 0.2]}
        intensity={theme.sunIntensity}
        color={theme.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-w}
        shadow-camera-right={w}
        shadow-camera-top={h}
        shadow-camera-bottom={-h}
      />
      {theme.stars && <Stars radius={70} depth={25} count={1600} factor={3.2} fade speed={0.4} />}

      {/* Ground — oversized so the horizon never shows void */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, -0.01, h / 2]} receiveShadow>
        <planeGeometry args={[w * 4, h * 4]} />
        <meshStandardMaterial map={floorTex} roughness={1} />
      </mesh>
      {theme.water && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, -0.06, h / 2]}>
          <planeGeometry args={[w * 12, h * 12]} />
          <meshStandardMaterial color="#2f9db0" transparent opacity={0.9} roughness={0.25} metalness={0.1} />
        </mesh>
      )}

      {/* Room floor slabs keep the 2D colour coding underfoot */}
      {data.rooms.map((r) => (
        <mesh
          key={r.id}
          position={[(r.x + r.width / 2) * SCALE, 0.035, (r.y + r.height / 2) * SCALE]}
          receiveShadow
        >
          <boxGeometry args={[r.width * SCALE, 0.07, r.height * SCALE]} />
          <meshStandardMaterial color={r.color} roughness={0.9} />
        </mesh>
      ))}

      {/* Walls with cap trim */}
      {walls.map((b, i) => {
        const cx = (b.minX + b.maxX) / 2;
        const cz = (b.minZ + b.maxZ) / 2;
        const sx = b.maxX - b.minX;
        const sz = b.maxZ - b.minZ;
        return (
          <group key={i}>
            <mesh position={[cx, b.height / 2, cz]} castShadow receiveShadow>
              <boxGeometry args={[sx, b.height, sz]} />
              <meshStandardMaterial color={theme.wall} roughness={0.85} />
            </mesh>
            <mesh position={[cx, b.height + 0.07, cz]} castShadow>
              <boxGeometry args={[sx + 0.12, 0.14, sz + 0.12]} />
              <meshStandardMaterial color={theme.trim} roughness={0.8} />
            </mesh>
          </group>
        );
      })}

      {/* Doorframes — posts and a header beam over every gap */}
      {doorways.map((d, i) => (
        <DoorFrame key={i} door={d} theme={theme} />
      ))}

      {/* Corner pillars give rooms silhouettes from a distance */}
      {data.rooms.flatMap((r) => {
        const corners: Array<[number, number]> = [
          [r.x, r.y], [r.x + r.width, r.y],
          [r.x, r.y + r.height], [r.x + r.width, r.y + r.height],
        ];
        return corners.map(([cx, cy], i) => (
          <mesh key={`${r.id}-p${i}`} position={[cx * SCALE, (WALL_HEIGHT + 0.5) / 2, cy * SCALE]} castShadow>
            <cylinderGeometry args={[0.26, 0.3, WALL_HEIGHT + 0.5, 10]} />
            <meshStandardMaterial color={theme.trim} roughness={0.8} />
          </mesh>
        ));
      })}

      {/* Procedural set-dressing — same palace always grows the same trees */}
      {dressing.map((d, i) => (
        <group key={`dress-${i}`} position={[d.x, 0, d.z]} rotation={[0, d.rot, 0]}>
          <DecorProp kind={d.kind} theme={theme} scale={d.scale} />
        </group>
      ))}

      {/* User decorations */}
      {decor.map((d) => (
        <group key={d.id} position={[d.x * SCALE, 0, d.z * SCALE]} rotation={[0, d.rot, 0]}>
          <DecorProp kind={d.kind} theme={theme} />
        </group>
      ))}

      {/* Loci */}
      {data.objects.map((o, i) => (
        <Locus
          key={o.id}
          obj={o}
          theme={theme}
          due={dueIds.has(o.id)}
          phase={i * 1.3}
          plinth={(o.roomId ? roomIndex.get(o.roomId) ?? 0 : 0) % 3}
        />
      ))}
      {litDue.map((o) => {
        const p = tileCenter(o.x, o.y);
        return (
          <pointLight
            key={`l-${o.id}`}
            position={[p.x, 2.1, p.z]}
            color={theme.accent}
            intensity={6}
            distance={7}
            decay={1.8}
          />
        );
      })}
      {litDecor.map((p, i) => (
        <pointLight
          key={`dl-${i}`}
          position={[p.x, 2.0, p.z]}
          color="#ffc46b"
          intensity={4.5}
          distance={6.5}
          decay={1.9}
        />
      ))}

      <Player palace={palace} walls={walls} onNear={onNear} onRoom={onRoom} statusRef={statusRef} />
    </>
  );
}

function DoorFrame({ door, theme }: { door: Doorway; theme: Theme3D }) {
  const half = DOOR_WIDTH / 2 + 0.09;
  const postGeom: [number, number, number] = door.axis === 'x'
    ? [0.2, WALL_HEIGHT, 0.5]
    : [0.5, WALL_HEIGHT, 0.2];
  const headerGeom: [number, number, number] = door.axis === 'x'
    ? [DOOR_WIDTH + 0.4, 0.62, 0.5]
    : [0.5, 0.62, DOOR_WIDTH + 0.4];
  const offsets: Array<[number, number]> = door.axis === 'x'
    ? [[-half, 0], [half, 0]]
    : [[0, -half], [0, half]];
  return (
    <group position={[door.x, 0, door.z]}>
      {offsets.map(([ox, oz], i) => (
        <mesh key={i} position={[ox, WALL_HEIGHT / 2, oz]} castShadow>
          <boxGeometry args={postGeom} />
          <meshStandardMaterial color={theme.trim} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, WALL_HEIGHT - 0.31, 0]} castShadow>
        <boxGeometry args={headerGeom} />
        <meshStandardMaterial color={theme.trim} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Locus({ obj, theme, due, phase, plinth }: {
  obj: PalaceObject; theme: Theme3D; due: boolean; phase: number; plinth: number;
}) {
  const p = tileCenter(obj.x, obj.y);
  return (
    <group position={[p.x, 0, p.z]}>
      {plinth === 0 && (
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.34, 0.42, 0.84, 12]} />
          <meshStandardMaterial color={theme.pedestal} roughness={0.8} />
        </mesh>
      )}
      {plinth === 1 && (
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.66, 0.84, 0.66]} />
          <meshStandardMaterial color={theme.pedestal} roughness={0.8} />
        </mesh>
      )}
      {plinth === 2 && (
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.38, 0.44, 0.84, 6]} />
          <meshStandardMaterial color={theme.pedestal} roughness={0.8} />
        </mesh>
      )}
      <mesh position={[0, 0.86, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.05, 14]} />
        <meshStandardMaterial
          color={due ? theme.accent : obj.color}
          emissive={due ? theme.accent : obj.color}
          emissiveIntensity={due ? 0.9 : 0.22}
          roughness={0.5}
        />
      </mesh>
      <LocusProp icon={obj.icon} color={obj.color} phase={phase} />
      {due && (
        <Sparkles count={16} scale={[1.3, 2.2, 1.3]} size={2.4} speed={0.45} color={theme.accent} position={[0, 1.5, 0]} />
      )}
    </group>
  );
}

// ── Decorate mode controller (inside the Canvas) ───────────────────────

function DecorateController({ palace, theme, decor, selectedKind, rotRef, onPlace, onRemove }: {
  palace: MemoryPalaceRecord;
  theme: Theme3D;
  decor: PalaceDecor[];
  selectedKind: string;
  rotRef: React.MutableRefObject<number>;
  onPlace: (wx: number, wz: number, rot: number) => void;
  onRemove: (id: string) => void;
}) {
  const camera = useThree((s) => s.camera);
  const ghost = useRef<THREE.Group>(null);
  const placeRing = useRef<THREE.Mesh>(null);
  const removeRing = useRef<THREE.Mesh>(null);
  const aim = useRef(new THREE.Vector3());
  const removableId = useRef<string | null>(null);
  const dir = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    camera.getWorldDirection(dir);
    // Cast the crosshair onto the ground plane; clamp the reach.
    const t = dir.y < -0.06
      ? Math.min(-camera.position.y / dir.y, 13)
      : 9;
    const margin = 0.6;
    const x = Math.max(margin, Math.min(palace.data.width * SCALE - margin, camera.position.x + dir.x * t));
    const z = Math.max(margin, Math.min(palace.data.height * SCALE - margin, camera.position.z + dir.z * t));
    aim.current.set(x, 0, z);

    if (ghost.current) {
      ghost.current.position.set(x, 0, z);
      ghost.current.rotation.y = rotRef.current;
    }
    placeRing.current?.position.set(x, 0.025, z);

    let best: PalaceDecor | null = null;
    let bd = 1.25 * 1.25;
    for (const d of decor) {
      const dx = d.x * SCALE - x;
      const dz = d.z * SCALE - z;
      const dd = dx * dx + dz * dz;
      if (dd < bd) { bd = dd; best = d; }
    }
    removableId.current = best?.id ?? null;
    if (removeRing.current) {
      removeRing.current.visible = best != null;
      if (best) removeRing.current.position.set(best.x * SCALE, 0.035, best.z * SCALE);
    }
  });

  useEffect(() => {
    const md = (e: MouseEvent) => {
      if (e.button === 0) {
        onPlace(aim.current.x, aim.current.z, rotRef.current);
      } else if (e.button === 2 && removableId.current) {
        onRemove(removableId.current);
      }
    };
    const cm = (e: Event) => e.preventDefault();
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') rotRef.current += Math.PI / 4;
    };
    window.addEventListener('mousedown', md);
    window.addEventListener('contextmenu', cm);
    window.addEventListener('keydown', kd);
    return () => {
      window.removeEventListener('mousedown', md);
      window.removeEventListener('contextmenu', cm);
      window.removeEventListener('keydown', kd);
    };
  }, [onPlace, onRemove, rotRef]);

  return (
    <>
      <group ref={ghost}>
        <DecorProp kind={selectedKind} theme={theme} />
      </group>
      <mesh ref={placeRing} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.64, 26]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.65} />
      </mesh>
      <mesh ref={removeRing} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.56, 0.72, 26]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.85} />
      </mesh>
    </>
  );
}

// ── Player ─────────────────────────────────────────────────────────────

const NEAR_DISTANCE = 2.3;

function Player({ palace, walls, onNear, onRoom, statusRef }: {
  palace: MemoryPalaceRecord;
  walls: WallBox[];
  onNear: (id: string | null) => void;
  onRoom: (name: string | null) => void;
  statusRef: React.MutableRefObject<Status>;
}) {
  const camera = useThree((s) => s.camera);
  const keys = useRef<Set<string>>(new Set());
  const pos = useRef(spawnPoint(palace.data));
  const lastNear = useRef<string | null>(null);
  const lastRoom = useRef<string | null>(null);
  const bob = useRef(0);
  const dataRef = useRef(palace.data);
  useEffect(() => {
    dataRef.current = palace.data;
  }, [palace.data]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.code);
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Spawn only when the palace itself changes — decorating or grading must
  // not teleport the player back to the door.
  useEffect(() => {
    const spawn = spawnPoint(dataRef.current);
    pos.current = spawn;
    camera.position.set(spawn.x, EYE_HEIGHT, spawn.z);
    camera.rotation.set(0, spawn.yaw, 0);
  }, [camera, palace.id]);

  const fwd = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_, rawDt) => {
    if (statusRef.current !== 'playing') return;
    const dt = Math.min(rawDt, 0.05);
    const k = keys.current;
    const fz = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const fx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const sprint = k.has('ShiftLeft') || k.has('ShiftRight');

    if (fz !== 0 || fx !== 0) {
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      right.crossVectors(fwd, UP);
      const speed = sprint ? 9 : 5.4;
      let nx = pos.current.x + (fwd.x * fz + right.x * fx) * speed * dt;
      let nz = pos.current.z + (fwd.z * fz + right.z * fx) * speed * dt;
      ({ x: nx, z: nz } = collide(nx, nz, walls));
      ({ x: nx, z: nz } = clampToMap(nx, nz, dataRef.current));
      pos.current.x = nx;
      pos.current.z = nz;
      bob.current += dt * 9;
    }

    camera.position.x = pos.current.x;
    camera.position.z = pos.current.z;
    camera.position.y = EYE_HEIGHT + Math.sin(bob.current) * 0.035;

    // Nearest locus within reach.
    let best: string | null = null;
    let bestD = NEAR_DISTANCE * NEAR_DISTANCE;
    for (const o of dataRef.current.objects) {
      const c = tileCenter(o.x, o.y);
      const dx = c.x - pos.current.x;
      const dz = c.z - pos.current.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = o.id; }
    }
    if (best !== lastNear.current) {
      lastNear.current = best;
      onNear(best);
    }

    // Current room name for the HUD.
    const tx = pos.current.x / SCALE;
    const tz = pos.current.z / SCALE;
    const room = dataRef.current.rooms.find(
      (r) => tx >= r.x && tx < r.x + r.width && tz >= r.y && tz < r.y + r.height,
    );
    const name = room?.name ?? null;
    if (name !== lastRoom.current) {
      lastRoom.current = name;
      onRoom(name);
    }
  });

  return null;
}

// ── HUD bits ───────────────────────────────────────────────────────────

function Overlay({ theme, children }: { theme: Theme3D; children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center text-center"
      style={{ background: `linear-gradient(180deg, ${theme.sky}cc, #111827e6)` }}
    >
      {children}
    </div>
  );
}

function ControlsLegend() {
  return (
    <p className="mt-5 text-[10px] font-mono uppercase tracking-wider text-white/50 leading-relaxed">
      wasd / arrows move · mouse look · shift run
      <br />
      e reveal · 1/2/3 grade · tab decorate · esc pause
    </p>
  );
}

function ExitLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="mt-4 text-[11px] font-mono uppercase tracking-wider text-white/60 hover:text-white bg-transparent border-none cursor-pointer underline underline-offset-4"
    >
      {label}
    </button>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-[9px] font-mono text-white bg-white/15 border border-white/25 rounded px-1 leading-relaxed">
      {children}
    </span>
  );
}
