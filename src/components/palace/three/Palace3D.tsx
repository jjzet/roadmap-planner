// First-person walkable palace. The 2D palace data is projected into a 3D
// scene (world.ts) and the spaced-repetition recall loop runs in-world: walk
// up to a glowing locus, try to remember what lives there, press E to check,
// grade yourself with 1/2/3.
//
// Lazy-loaded (three.js is a heavy chunk) — import via React.lazy only.

/* eslint-disable react-hooks/immutability -- react-three-fiber is an
   imperative escape hatch: mutating the camera inside useFrame/useEffect is
   the supported r3f pattern, not a React state violation. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import type { MemoryPalaceRecord, PalaceObject, ReviewQuality } from '@/types';
import { usePalaceReviewStore, reviewKey, isDue } from '@/store/palaceReviewStore';
import { bumpStreak } from '../streak';
import {
  THEME_3D, SCALE, EYE_HEIGHT, WALL_HEIGHT,
  buildWalls, collide, clampToMap, spawnPoint, tileCenter,
  type WallBox, type Theme3D,
} from './world';
import { LocusProp } from './Props3D';

type Status = 'intro' | 'playing' | 'paused';

interface Palace3DProps {
  palace: MemoryPalaceRecord;
  onExit: () => void;
}

export default function Palace3D({ palace, onExit }: Palace3DProps) {
  const theme = THEME_3D[palace.theme] ?? THEME_3D.overworld;
  const walls = useMemo(() => buildWalls(palace.data), [palace.data]);

  const [status, setStatus] = useState<Status>('intro');
  const [nearId, setNearId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [justGraded, setJustGraded] = useState<ReviewQuality | null>(null);
  const [gradedCount, setGradedCount] = useState(0);
  const [streak, setStreak] = useState<number | null>(null);

  const controlsRef = useRef<PointerLockControlsImpl | null>(null);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const reviews = usePalaceReviewStore((s) => s.reviews);
  const recordReview = usePalaceReviewStore((s) => s.recordReview);
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

  // HUD keys: E/Space reveal, 1/2/3 grade. Movement keys live in <Player>.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (statusRef.current !== 'playing') return;
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

  return (
    <div className="flex-1 relative overflow-hidden" style={{ background: theme.sky }}>
      <Canvas
        shadows
        camera={{ fov: 75, near: 0.1, far: 220 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Scene
          palace={palace}
          theme={theme}
          walls={walls}
          dueIds={dueIds}
          onNear={handleNear}
          onRoom={setRoomName}
          statusRef={statusRef}
        />
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
            <div className="w-1.5 h-1.5 rounded-full bg-white/80 shadow-[0_0_4px_rgba(0,0,0,0.6)]" />
          </div>

          {/* Top bar */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
            <div className="bg-black/45 backdrop-blur-sm rounded px-3 py-2">
              <p className="text-[12px] font-mono font-semibold text-white tracking-wide">
                {palace.name}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/70 mt-0.5">
                {roomName ?? 'Outside'}
              </p>
            </div>
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
          </div>

          {/* Recall card */}
          {nearLocus && (
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

          {/* Controls hint */}
          <div className="absolute bottom-3 right-3 pointer-events-none">
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/50 bg-black/30 rounded px-2 py-1">
              wasd move · mouse look · esc pause
            </p>
          </div>
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
              : 'Wander the rooms and let the route burn the memories in.'}
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
  dueIds: Set<string>;
  onNear: (id: string | null) => void;
  onRoom: (name: string | null) => void;
  statusRef: React.MutableRefObject<Status>;
}

function Scene({ palace, theme, walls, dueIds, onNear, onRoom, statusRef }: SceneProps) {
  const { data } = palace;
  const w = data.width * SCALE;
  const h = data.height * SCALE;

  // Cap the number of real lights; the rest of the due loci still sparkle.
  const litDue = useMemo(
    () => data.objects.filter((o) => dueIds.has(o.id)).slice(0, 8),
    [data.objects, dueIds],
  );

  return (
    <>
      <color attach="background" args={[theme.sky]} />
      <fog attach="fog" args={[theme.fog, theme.fogNear, theme.fogFar]} />
      <ambientLight intensity={theme.ambient} />
      <hemisphereLight args={[theme.sky, theme.floor, 0.5]} />
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
        <meshStandardMaterial color={theme.floor} roughness={1} />
      </mesh>

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

      {/* Walls */}
      {walls.map((b, i) => (
        <mesh
          key={i}
          position={[(b.minX + b.maxX) / 2, b.height / 2, (b.minZ + b.maxZ) / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[b.maxX - b.minX, b.height, b.maxZ - b.minZ]} />
          <meshStandardMaterial color={theme.wall} roughness={0.85} />
        </mesh>
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

      {/* Loci */}
      {data.objects.map((o, i) => (
        <Locus key={o.id} obj={o} theme={theme} due={dueIds.has(o.id)} phase={i * 1.3} />
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

      <Player palace={palace} walls={walls} onNear={onNear} onRoom={onRoom} statusRef={statusRef} />
    </>
  );
}

function Locus({ obj, theme, due, phase }: {
  obj: PalaceObject; theme: Theme3D; due: boolean; phase: number;
}) {
  const p = tileCenter(obj.x, obj.y);
  return (
    <group position={[p.x, 0, p.z]}>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.42, 0.84, 12]} />
        <meshStandardMaterial color={theme.pedestal} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.86, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.05, 14]} />
        <meshStandardMaterial
          color={due ? theme.accent : theme.trim}
          emissive={due ? theme.accent : '#000000'}
          emissiveIntensity={due ? 0.9 : 0}
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

  useEffect(() => {
    const spawn = spawnPoint(palace.data);
    pos.current = spawn;
    camera.position.set(spawn.x, EYE_HEIGHT, spawn.z);
    camera.rotation.set(0, spawn.yaw, 0);
    const down = (e: KeyboardEvent) => keys.current.add(e.code);
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [camera, palace.data]);

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
      ({ x: nx, z: nz } = clampToMap(nx, nz, palace.data));
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
    for (const o of palace.data.objects) {
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
    const room = palace.data.rooms.find(
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
      e reveal · 1/2/3 grade · esc pause
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
