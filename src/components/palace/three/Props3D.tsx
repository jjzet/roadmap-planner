// 3D props for palace loci — one distinct silhouette per icon so every locus
// reads at a glance from across a room. Built from primitives (no models to
// load); colours come from the object's stored accent colour.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PalaceObjectIcon } from '@/types';

interface PropProps {
  icon: PalaceObjectIcon;
  color: string;
  // Phase offset so a room of props doesn't bob in lockstep.
  phase?: number;
}

export function LocusProp({ icon, color, phase = 0 }: PropProps) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime + phase;
    g.rotation.y = t * 0.6;
    g.position.y = 1.05 + Math.sin(t * 1.6) * 0.08;
  });
  return (
    <group ref={group} position={[0, 1.05, 0]}>
      <PropMesh icon={icon} color={color} />
    </group>
  );
}

function PropMesh({ icon, color }: { icon: PalaceObjectIcon; color: string }) {
  const c = color;
  const dark = useMemo(() => new THREE.Color(c).multiplyScalar(0.55), [c]);
  switch (icon) {
    case 'chest':
      return (
        <group>
          <mesh castShadow position={[0, -0.06, 0]}>
            <boxGeometry args={[0.5, 0.3, 0.34]} />
            <meshStandardMaterial color={dark} roughness={0.7} />
          </mesh>
          <mesh castShadow position={[0, 0.14, 0]}>
            <boxGeometry args={[0.52, 0.14, 0.36]} />
            <meshStandardMaterial color={c} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.181]}>
            <boxGeometry args={[0.08, 0.34, 0.02]} />
            <meshStandardMaterial color="#f5d76e" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      );
    case 'book':
      return (
        <group rotation={[0.15, 0, 0.1]}>
          <mesh castShadow>
            <boxGeometry args={[0.46, 0.08, 0.34]} />
            <meshStandardMaterial color={c} roughness={0.6} />
          </mesh>
          <mesh castShadow position={[0.02, 0.09, 0]} rotation={[0, 0.18, 0]}>
            <boxGeometry args={[0.42, 0.07, 0.3]} />
            <meshStandardMaterial color={dark} roughness={0.6} />
          </mesh>
        </group>
      );
    case 'scroll':
      return (
        <group rotation={[0, 0, Math.PI / 2.2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.5, 12]} />
            <meshStandardMaterial color="#efe6cf" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.05, 12]} />
            <meshStandardMaterial color={c} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.26, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.05, 12]} />
            <meshStandardMaterial color={c} roughness={0.5} />
          </mesh>
        </group>
      );
    case 'crystal':
      return (
        <mesh castShadow scale={[0.55, 1, 0.55]}>
          <octahedronGeometry args={[0.34]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35} roughness={0.2} metalness={0.1} />
        </mesh>
      );
    case 'key':
      return (
        <group rotation={[0, 0, -0.6]}>
          <mesh castShadow position={[0, 0.16, 0]}>
            <torusGeometry args={[0.13, 0.045, 10, 24]} />
            <meshStandardMaterial color={c} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh castShadow position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.36, 10]} />
            <meshStandardMaterial color={c} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.07, -0.24, 0]}>
            <boxGeometry args={[0.12, 0.05, 0.05]} />
            <meshStandardMaterial color={c} metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      );
    case 'tree':
      return (
        <group position={[0, -0.1, 0]}>
          <mesh castShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.09, 0.3, 8]} />
            <meshStandardMaterial color="#7a5230" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 0.32, 0]}>
            <coneGeometry args={[0.26, 0.4, 8]} />
            <meshStandardMaterial color={c} roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0, 0.55, 0]}>
            <coneGeometry args={[0.18, 0.3, 8]} />
            <meshStandardMaterial color={dark} roughness={0.8} />
          </mesh>
        </group>
      );
    case 'sign':
      return (
        <group position={[0, -0.05, 0]}>
          <mesh castShadow position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.45, 8]} />
            <meshStandardMaterial color="#7a5230" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 0.16, 0]}>
            <boxGeometry args={[0.5, 0.26, 0.05]} />
            <meshStandardMaterial color={c} roughness={0.7} />
          </mesh>
        </group>
      );
    case 'lantern':
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.24, 0.32, 0.24]} />
            <meshStandardMaterial color={dark} roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.6} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <coneGeometry args={[0.17, 0.12, 4]} />
            <meshStandardMaterial color={dark} roughness={0.5} metalness={0.4} />
          </mesh>
        </group>
      );
    case 'npc':
      return (
        <group position={[0, -0.06, 0]}>
          <mesh castShadow position={[0, 0, 0]}>
            <capsuleGeometry args={[0.14, 0.26, 6, 12]} />
            <meshStandardMaterial color={c} roughness={0.6} />
          </mesh>
          <mesh castShadow position={[0, 0.36, 0]}>
            <sphereGeometry args={[0.13, 14, 14]} />
            <meshStandardMaterial color="#f2d4b5" roughness={0.7} />
          </mesh>
        </group>
      );
    case 'gem':
      return (
        <mesh castShadow>
          <icosahedronGeometry args={[0.26]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.25} roughness={0.15} metalness={0.2} />
        </mesh>
      );
    case 'potion':
      return (
        <group position={[0, -0.04, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.2, 14, 14]} />
            <meshStandardMaterial color={c} transparent opacity={0.85} roughness={0.15} emissive={c} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.14, 10]} />
            <meshStandardMaterial color="#d8cfc0" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.31, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 0.06, 10]} />
            <meshStandardMaterial color="#8a6f4d" roughness={0.8} />
          </mesh>
        </group>
      );
    case 'sword':
      return (
        <group rotation={[0, 0, -0.5]}>
          <mesh castShadow position={[0, 0.12, 0]}>
            <boxGeometry args={[0.07, 0.52, 0.025]} />
            <meshStandardMaterial color="#cfd6dd" metalness={0.8} roughness={0.25} />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <boxGeometry args={[0.24, 0.05, 0.05]} />
            <meshStandardMaterial color={c} metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.27, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.16, 8]} />
            <meshStandardMaterial color={dark} roughness={0.7} />
          </mesh>
        </group>
      );
    case 'shield':
      return (
        <group rotation={[0.12, 0, 0]}>
          <mesh castShadow scale={[1, 1.25, 1]}>
            <cylinderGeometry args={[0.26, 0.26, 0.06, 18]} />
            <meshStandardMaterial color={c} roughness={0.45} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.04, 0]} scale={[1, 1.25, 1]}>
            <cylinderGeometry args={[0.09, 0.09, 0.06, 14]} />
            <meshStandardMaterial color="#f5d76e" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      );
    case 'star':
      return (
        <group>
          <mesh castShadow scale={[0.5, 1, 0.5]}>
            <octahedronGeometry args={[0.3]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.6} roughness={0.2} />
          </mesh>
          <mesh scale={[1, 0.5, 0.5]} rotation={[0, Math.PI / 4, 0]}>
            <octahedronGeometry args={[0.3]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.6} roughness={0.2} />
          </mesh>
        </group>
      );
    case 'heart':
      return (
        <group rotation={[0, 0, Math.PI / 4]} scale={0.9}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.3, 0.16]} />
            <meshStandardMaterial color={c} roughness={0.4} />
          </mesh>
          <mesh castShadow position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.16, 16]} />
            <meshStandardMaterial color={c} roughness={0.4} />
          </mesh>
          <mesh castShadow position={[0.15, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.16, 16]} />
            <meshStandardMaterial color={c} roughness={0.4} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh castShadow>
          <sphereGeometry args={[0.22, 14, 14]} />
          <meshStandardMaterial color={c} roughness={0.5} />
        </mesh>
      );
  }
}
