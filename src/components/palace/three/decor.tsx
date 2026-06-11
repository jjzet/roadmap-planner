// Decoration props for 3D palaces — the placeable palette plus the meshes.
// Like the locus props, everything is primitives: no assets to load, crisp
// silhouettes, and per-theme trim colours where it matters.
//
// Decor is cosmetic by design (no collision, no content), but personal
// set-dressing is a real retrieval cue: "Sarah's locus is past the two
// barrels by the torch" is exactly how spatial memory works.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Theme3D } from './world';

interface DecorPropProps {
  kind: string;
  theme: Theme3D;
  scale?: number;
}

export function DecorProp({ kind, theme, scale = 1 }: DecorPropProps) {
  return (
    <group scale={scale}>
      <DecorMesh kind={kind} theme={theme} />
    </group>
  );
}

// Flickering flame for torches — tiny imperative animation, no state.
function Flame({ y, color }: { y: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.elapsedTime * 9;
    const s = 1 + Math.sin(t) * 0.16 + Math.sin(t * 2.7) * 0.08;
    m.scale.set(s, 1.15 * s, s);
  });
  return (
    <mesh ref={ref} position={[0, y, 0]}>
      <coneGeometry args={[0.09, 0.26, 7]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.4} />
    </mesh>
  );
}

function DecorMesh({ kind, theme }: { kind: string; theme: Theme3D }) {
  switch (kind) {
    case 'torch':
      return (
        <group>
          <mesh castShadow position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 1.5, 8]} />
            <meshStandardMaterial color="#4c3a26" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.52, 0]}>
            <cylinderGeometry args={[0.09, 0.06, 0.16, 8]} />
            <meshStandardMaterial color="#2b2118" roughness={0.9} />
          </mesh>
          <Flame y={1.74} color="#ffab4d" />
        </group>
      );
    case 'lamp':
      return (
        <group>
          <mesh castShadow position={[0, 1.05, 0]}>
            <cylinderGeometry args={[0.045, 0.07, 2.1, 8]} />
            <meshStandardMaterial color={theme.trim} roughness={0.7} metalness={0.3} />
          </mesh>
          <mesh position={[0, 2.18, 0]}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshStandardMaterial color="#ffe9b0" emissive="#ffd980" emissiveIntensity={1.8} />
          </mesh>
          <mesh position={[0, 2.34, 0]}>
            <coneGeometry args={[0.22, 0.14, 8]} />
            <meshStandardMaterial color={theme.trim} roughness={0.7} metalness={0.3} />
          </mesh>
        </group>
      );
    case 'banner':
      return (
        <group>
          <mesh castShadow position={[0, 1.25, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 2.5, 8]} />
            <meshStandardMaterial color={theme.trim} roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.42, 0]}>
            <boxGeometry args={[0.9, 0.05, 0.05]} />
            <meshStandardMaterial color={theme.trim} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0.28, 1.92, 0]}>
            <boxGeometry args={[0.5, 0.95, 0.03]} />
            <meshStandardMaterial color="#b03044" roughness={0.75} side={THREE.DoubleSide} />
          </mesh>
        </group>
      );
    case 'statue':
      return (
        <group>
          <mesh castShadow position={[0, 0.25, 0]}>
            <boxGeometry args={[0.7, 0.5, 0.7]} />
            <meshStandardMaterial color={theme.pedestal} roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0, 0.92, 0]}>
            <capsuleGeometry args={[0.18, 0.5, 6, 12]} />
            <meshStandardMaterial color="#a6a8ad" roughness={0.55} metalness={0.15} />
          </mesh>
          <mesh castShadow position={[0, 1.42, 0]}>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color="#a6a8ad" roughness={0.55} metalness={0.15} />
          </mesh>
        </group>
      );
    case 'tree':
      return (
        <group>
          <mesh castShadow position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.14, 0.2, 1.4, 8]} />
            <meshStandardMaterial color="#6a4a2c" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 1.75, 0]}>
            <coneGeometry args={[0.95, 1.5, 8]} />
            <meshStandardMaterial color="#3f8f4f" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 2.6, 0]}>
            <coneGeometry args={[0.62, 1.1, 8]} />
            <meshStandardMaterial color="#357a43" roughness={0.9} />
          </mesh>
        </group>
      );
    case 'shrub':
      return (
        <group>
          <mesh castShadow position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.4, 10, 10]} />
            <meshStandardMaterial color="#5d9c4a" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0.3, 0.22, 0.12]}>
            <sphereGeometry args={[0.26, 10, 10]} />
            <meshStandardMaterial color="#6fae54" roughness={0.95} />
          </mesh>
        </group>
      );
    case 'rock':
      return (
        <group>
          <mesh castShadow position={[0, 0.28, 0]} rotation={[0.3, 0.7, 0.1]}>
            <dodecahedronGeometry args={[0.42]} />
            <meshStandardMaterial color="#86868d" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0.42, 0.14, -0.2]} rotation={[0.8, 0.2, 0.4]}>
            <dodecahedronGeometry args={[0.2]} />
            <meshStandardMaterial color="#74747b" roughness={0.95} />
          </mesh>
        </group>
      );
    case 'crate':
      return (
        <group>
          <mesh castShadow position={[0, 0.3, 0]}>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color="#a9743e" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.3, 0.301]}>
            <boxGeometry args={[0.6, 0.08, 0.01]} />
            <meshStandardMaterial color="#7c5429" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.3, 0.301]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.6, 0.08, 0.01]} />
            <meshStandardMaterial color="#7c5429" roughness={0.85} />
          </mesh>
        </group>
      );
    case 'barrel':
      return (
        <group>
          <mesh castShadow position={[0, 0.38, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.76, 12]} />
            <meshStandardMaterial color="#7c5a32" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.025, 8, 18]} />
            <meshStandardMaterial color="#3c3c40" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.025, 8, 18]} />
            <meshStandardMaterial color="#3c3c40" metalness={0.5} roughness={0.5} />
          </mesh>
        </group>
      );
    case 'bookshelf':
      return (
        <group>
          <mesh castShadow position={[0, 0.85, 0]}>
            <boxGeometry args={[1.1, 1.7, 0.32]} />
            <meshStandardMaterial color="#6b4a2c" roughness={0.85} />
          </mesh>
          {[0.45, 0.95, 1.45].map((y, i) => (
            <mesh key={i} position={[0, y, 0.13]}>
              <boxGeometry args={[0.94, 0.3, 0.1]} />
              <meshStandardMaterial
                color={['#b03044', '#2b6cb0', '#9a7b2f'][i]}
                roughness={0.8}
              />
            </mesh>
          ))}
        </group>
      );
    case 'rug':
      return (
        <group>
          <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[0.95, 24]} />
            <meshStandardMaterial color="#b03a5b" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.62, 0.78, 24]} />
            <meshStandardMaterial color="#e0b94f" roughness={0.95} />
          </mesh>
        </group>
      );
    case 'fence':
      return (
        <group>
          {[-0.55, 0.55].map((x) => (
            <mesh key={x} castShadow position={[x, 0.4, 0]}>
              <cylinderGeometry args={[0.055, 0.065, 0.8, 7]} />
              <meshStandardMaterial color="#9b8560" roughness={0.95} />
            </mesh>
          ))}
          {[0.55, 0.25].map((y) => (
            <mesh key={y} castShadow position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.04, 0.04, 1.3, 7]} />
              <meshStandardMaterial color="#a08a64" roughness={0.95} />
            </mesh>
          ))}
        </group>
      );
    // ── Fixtures (room furnishings; not in the placeable palette) ──
    case 'weaponrack':
      return (
        <group>
          <mesh castShadow position={[0, 0.55, 0]}>
            <boxGeometry args={[1.1, 1.1, 0.08]} />
            <meshStandardMaterial color="#5d4326" roughness={0.9} />
          </mesh>
          {[-0.3, 0, 0.3].map((x, i) => (
            <mesh key={i} castShadow position={[x, 0.62, 0.07]} rotation={[0, 0, i === 1 ? 0 : (i ? -0.16 : 0.16)]}>
              <boxGeometry args={[0.06, 0.85, 0.03]} />
              <meshStandardMaterial color="#cfd6dd" metalness={0.8} roughness={0.25} />
            </mesh>
          ))}
        </group>
      );
    case 'table':
      return (
        <group>
          <mesh castShadow position={[0, 0.52, 0]}>
            <boxGeometry args={[1.3, 0.08, 0.8]} />
            <meshStandardMaterial color="#7a5a36" roughness={0.85} />
          </mesh>
          {[[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]].map(([x, z], i) => (
            <mesh key={i} castShadow position={[x, 0.25, z]}>
              <boxGeometry args={[0.08, 0.5, 0.08]} />
              <meshStandardMaterial color="#5d4326" roughness={0.9} />
            </mesh>
          ))}
        </group>
      );
    case 'hearth':
      return (
        <group>
          <mesh castShadow position={[-0.55, 0.5, 0]}>
            <boxGeometry args={[0.3, 1.0, 0.5]} />
            <meshStandardMaterial color="#6e6a63" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0.55, 0.5, 0]}>
            <boxGeometry args={[0.3, 1.0, 0.5]} />
            <meshStandardMaterial color="#6e6a63" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 1.06, 0]}>
            <boxGeometry args={[1.4, 0.22, 0.55]} />
            <meshStandardMaterial color="#57534b" roughness={0.95} />
          </mesh>
          <Flame y={0.34} color="#ff8c3b" />
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.7, 0.2, 0.4]} />
            <meshStandardMaterial color="#2b2118" roughness={1} />
          </mesh>
        </group>
      );
    case 'dais':
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, 0.11, 0]}>
            <cylinderGeometry args={[1.15, 1.25, 0.22, 18]} />
            <meshStandardMaterial color={theme.pedestal} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.23, 0]}>
            <cylinderGeometry args={[0.85, 0.9, 0.06, 18]} />
            <meshStandardMaterial color={theme.trim} roughness={0.8} />
          </mesh>
        </group>
      );
    case 'fountain':
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.85, 0.95, 0.36, 16]} />
            <meshStandardMaterial color={theme.pedestal} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.37, 0]}>
            <cylinderGeometry args={[0.72, 0.72, 0.04, 16]} />
            <meshStandardMaterial color="#3aa3c0" transparent opacity={0.85} roughness={0.15} emissive="#1d7d99" emissiveIntensity={0.25} />
          </mesh>
          <mesh castShadow position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.1, 0.14, 0.5, 10]} />
            <meshStandardMaterial color={theme.trim} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.12, 10, 10]} />
            <meshStandardMaterial color="#7fd4e8" transparent opacity={0.8} roughness={0.1} emissive="#3aa3c0" emissiveIntensity={0.4} />
          </mesh>
        </group>
      );
    case 'bigcrystal':
      return (
        <group>
          <mesh castShadow position={[0, 0.7, 0]} scale={[0.5, 1.4, 0.5]}>
            <octahedronGeometry args={[0.55]} />
            <meshStandardMaterial color="#8be8dc" emissive="#41e0d0" emissiveIntensity={0.7} roughness={0.15} transparent opacity={0.92} />
          </mesh>
          <mesh castShadow position={[0.4, 0.3, 0.15]} scale={[0.35, 0.8, 0.35]} rotation={[0.2, 0.5, -0.15]}>
            <octahedronGeometry args={[0.4]} />
            <meshStandardMaterial color="#8be8dc" emissive="#41e0d0" emissiveIntensity={0.55} roughness={0.15} transparent opacity={0.92} />
          </mesh>
        </group>
      );
    case 'mushroom':
      return (
        <group>
          <mesh castShadow position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.16, 0.22, 0.6, 10]} />
            <meshStandardMaterial color="#e8ddc8" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 0.66, 0]}>
            <sphereGeometry args={[0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#c0392b" roughness={0.8} emissive="#5e1410" emissiveIntensity={0.15} />
          </mesh>
        </group>
      );
    case 'campfire':
      return (
        <group>
          {[0, 1, 2].map((i) => (
            <mesh key={i} castShadow position={[0, 0.08, 0]} rotation={[0, (i * Math.PI) / 3, Math.PI / 2]}>
              <cylinderGeometry args={[0.07, 0.07, 0.9, 7]} />
              <meshStandardMaterial color="#5d4326" roughness={0.95} />
            </mesh>
          ))}
          <Flame y={0.32} color="#ff8c3b" />
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.5, 14]} />
            <meshStandardMaterial color="#3a342c" roughness={1} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh castShadow position={[0, 0.25, 0]}>
          <boxGeometry args={[0.4, 0.5, 0.4]} />
          <meshStandardMaterial color="#999" roughness={0.8} />
        </mesh>
      );
  }
}
