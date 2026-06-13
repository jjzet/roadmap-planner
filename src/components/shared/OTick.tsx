import { useRef, useState } from 'react';

const BURST_COLORS = ['var(--blue)', 'var(--blue-mid)', 'var(--lavender)', 'var(--sand)'];

interface Particle {
  bx: number;
  by: number;
  br: number;
  color: string;
}

function makeParticles(): Particle[] {
  return Array.from({ length: 8 }).map((_, i) => {
    const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 16 + Math.random() * 14;
    return {
      bx: Math.cos(angle) * dist,
      by: Math.sin(angle) * dist,
      br: Math.round(Math.random() * 180 - 90),
      color: BURST_COLORS[i % BURST_COLORS.length],
    };
  });
}

interface Props {
  checked: boolean;
  onToggle: () => void;
  size?: number;
  title?: string;
}

/**
 * Orbit soft-square checkbox. Completing draws the check stroke and fires a
 * small soft-square burst — the endorphin moment, kept quick and quiet.
 */
export function OTick({ checked, onToggle, size = 20, title }: Props) {
  const [burst, setBurst] = useState<{ key: number; particles: Particle[] } | null>(null);
  const burstingRef = useRef(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!checked && !burstingRef.current) {
      burstingRef.current = true;
      setBurst((b) => ({ key: (b?.key ?? 0) + 1, particles: makeParticles() }));
      setTimeout(() => { burstingRef.current = false; }, 600);
    }
    onToggle();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`o-tick ${checked ? 'done' : ''}`}
      style={{ width: size, height: size }}
      title={title}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && (
        <svg viewBox="0 0 16 16" width={size - 8} height={size - 8} aria-hidden>
          <path
            d="M3.5 8.5l3 3L12.5 5"
            fill="none"
            stroke="var(--paper)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {burst && checked && (
        <span key={burst.key} className="absolute inset-0 pointer-events-none" aria-hidden>
          {burst.particles.map((p, i) => (
            <span
              key={i}
              className="o-burst"
              style={{
                left: size / 2 - 3,
                top: size / 2 - 3,
                background: p.color,
                ['--bx' as string]: `${p.bx}px`,
                ['--by' as string]: `${p.by}px`,
                ['--br' as string]: `${p.br}deg`,
              }}
            />
          ))}
        </span>
      )}
    </button>
  );
}
